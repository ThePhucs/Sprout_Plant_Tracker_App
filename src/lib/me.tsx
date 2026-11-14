import { createContext, useContext } from 'react';

/** The signed-in person, for screens that need to know "is this mine?" or "can I share?". */
export type Me = { id: string; verified: boolean };
export const MeContext = createContext<Me>({ id: '', verified: false });
export const useMe = () => useContext(MeContext);
