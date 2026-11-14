import { useEffect, useState, type FormEvent } from 'react';
import { useLang } from '../i18n';
import { supabase } from '../lib/supabase';
import { usePlants } from '../lib/plants';
import { useMe } from '../lib/me';
import { useMemberNames } from '../lib/social';
import { goBack, navigate } from '../lib/router';
import { useToast } from '../components/Toast';
import { useConfirm } from '../components/Confirm';
import { Icon } from '../components/Icon';
import { Photo } from '../components/Photo';
import { formatDate } from '../../shared/dates';
import type { CareLog } from '../../shared/plants';

type Post = CareLog & { user_id: string; plants: { name: string; shared: boolean; cover_photo_path: string | null } };
type Comment = { id: number; user_id: string; body: string; created_at: string };

/** One photo: full size, who and which plant, likes and comments. Owner also gets "use as plant photo" and delete. */
export function PhotoPost({ id }: { id: number }) {
  const { t, lang } = useLang();
  const me = useMe();
  const names = useMemberNames();
  const { today, setCover, deletePhoto } = usePlants();
  const toast = useToast();
  const confirm = useConfirm();
  const [post, setPost] = useState<Post | null | undefined>(undefined);
  const [likes, setLikes] = useState<string[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);

  const loadSocial = async () => {
    const [l, c] = await Promise.all([
      supabase.from('likes').select('user_id').eq('log_id', id),
      supabase.from('comments').select('id, user_id, body, created_at').eq('log_id', id).order('id'),
    ]);
    setLikes((l.data ?? []).map((r) => r.user_id));
    setComments(c.data ?? []);
  };

  useEffect(() => {
    supabase.from('care_logs').select('*, plants(name, shared, cover_photo_path)').eq('id', id).maybeSingle<Post>()
      .then(({ data }) => setPost(data && data.photo_path ? data : null));
    loadSocial();
  }, [id]);

  if (post === undefined) return null;
  if (!post) {
    return (
      <>
        <BackButton />
        <p className="card">{t('photoNotFound')}</p>
      </>
    );
  }

  const mine = post.user_id === me.id;
  const social = post.plants.shared; // likes and comments only exist on shared plants
  const liked = likes.includes(me.id);
  const nameOf = (uid: string) => (uid === me.id ? t('you') : names[uid] ?? t('someone'));

  const toggleLike = async () => {
    setLikes((l) => (liked ? l.filter((u) => u !== me.id) : [...l, me.id])); // instant; corrected below on failure
    const { error } = liked
      ? await supabase.from('likes').delete().eq('log_id', id).eq('user_id', me.id)
      : await supabase.from('likes').insert({ log_id: id });
    if (error) { toast({ message: t('errSave') }); loadSocial(); }
  };

  const send = async (e: FormEvent) => {
    e.preventDefault();
    const body = draft.trim();
    if (!body) return;
    setBusy(true);
    const { error } = await supabase.from('comments').insert({ log_id: id, body });
    setBusy(false);
    if (error) return toast({ message: t(error.message.includes('too many comments') ? 'errTooManyComments' : 'errSave') });
    setDraft('');
    loadSocial();
  };

  const removeComment = async (c: Comment) => {
    if (!(await confirm(t('confirmDeleteComment'), t('delete')))) return;
    const { error } = await supabase.from('comments').delete().eq('id', c.id);
    if (error) toast({ message: t('errSave') });
    loadSocial();
  };

  return (
    <>
      <BackButton />
      <header className="post-head">
        <div>
          <strong>{mine ? post.plants.name : `${nameOf(post.user_id)} · ${post.plants.name}`}</strong>
          <small className="muted">{formatDate(post.date, lang, today)}</small>
        </div>
        <button className="link" onClick={() => navigate(`/plants/${post.plant_id}`)}>{t('viewPlant')}</button>
      </header>

      <Photo path={post.photo_path!} alt={`${post.plants.name}, ${formatDate(post.date, lang, today)}`} className="post-img" />
      {post.note && <p>{post.note}</p>}

      {social && (
        <div className="post-actions">
          <button className={`like-btn ${liked ? 'liked' : ''}`} onClick={toggleLike} disabled={!me.verified}
            aria-pressed={liked} aria-label={liked ? t('unlike') : t('like')}>
            <Icon name="heart" size={22} filled={liked} />
            <span>{likes.length || ''}</span>
          </button>
        </div>
      )}

      {mine && (
        <div className="row">
          {post.plants.cover_photo_path !== post.photo_path && (
            <button className="button secondary" onClick={async () => {
              try {
                await setCover(post.plant_id, post.photo_path);
                setPost({ ...post, plants: { ...post.plants, cover_photo_path: post.photo_path } });
                toast({ message: t('coverSet') });
              }
              catch { toast({ message: t('errSave') }); }
            }}>{t('setCover')}</button>
          )}
          <button className="button quiet-danger" onClick={async () => {
            if (!(await confirm(t('confirmDeletePhoto'), t('deletePhoto')))) return;
            try { await deletePhoto(post); toast({ message: t('photoDeleted') }); goBack(`/plants/${post.plant_id}`); }
            catch { toast({ message: t('errSave') }); }
          }}>{t('deletePhoto')}</button>
        </div>
      )}

      {social && (
        <section className="comments">
          <h2 className="section-title">{t('comments')}{comments.length ? ` · ${comments.length}` : ''}</h2>
          {comments.length === 0 && <p className="muted">{t('noComments')}</p>}
          <ul>
            {comments.map((c) => (
              <li key={c.id}>
                <div>
                  <strong>{nameOf(c.user_id)}</strong>
                  <p>{c.body}</p>
                </div>
                {(c.user_id === me.id || mine) && (
                  <button className="icon-btn" onClick={() => removeComment(c)} aria-label={t('deleteComment')}>
                    <Icon name="close" size={16} />
                  </button>
                )}
              </li>
            ))}
          </ul>
          {me.verified && (
            <form className="comment-form" onSubmit={send}>
              <textarea value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={300} rows={1}
                placeholder={t('writeComment')} aria-label={t('writeComment')} />
              <button className="button small" disabled={busy || !draft.trim()}>{t('send')}</button>
            </form>
          )}
        </section>
      )}
    </>
  );
}

function BackButton() {
  const { t } = useLang();
  return <button className="link back" onClick={() => goBack('/garden')}><Icon name="back" size={18} />{t('back')}</button>;
}
