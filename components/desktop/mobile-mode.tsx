'use client'

import { createContext, useContext } from 'react'

/**
 * How the offer card, which is rendered deep inside the server-rendered résumé, asks the shell
 * above it to switch over.
 *
 * A context rather than a prop because the résumé is passed down as an already-rendered node —
 * the same arrangement `OpenCardContext` uses to let a card body open another card.
 */
export const EnterInteractiveContext = createContext<() => void>(() => {})

export const useEnterInteractive = () => useContext(EnterInteractiveContext)
