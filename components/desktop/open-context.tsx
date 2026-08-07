'use client'

import { createContext, useContext } from 'react'

/**
 * Lets a server-rendered card body open another card without the body itself being a client
 * component. Only the buttons inside it are — the prose stays in the server HTML.
 */
export const OpenCardContext = createContext<(id: string) => void>(() => {})

export const useOpenCard = () => useContext(OpenCardContext)
