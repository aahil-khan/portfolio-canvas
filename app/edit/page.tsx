import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { Editor } from '@/components/edit/editor'
import { editCopy } from '@/content/edit'
import { devFake, editConfig } from '@/lib/edit/config'
import { COOKIE, unseal } from '@/lib/edit/session'

import './edit.css'

/*
 * The content editor. Three states, decided here on the server so nothing about the editor
 * reaches a browser that is not signed in as the owner:
 *
 *   not configured → 404, as if the page did not exist
 *   signed out     → one button, off to GitHub
 *   signed in      → the editor, which loads the content itself from /api/edit/content
 *
 * Someone else's GitHub account never gets this far: the callback turns them away before a
 * session exists.
 */

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Editor',
  robots: { index: false, follow: false, nocache: true },
}

export default async function EditPage() {
  if (devFake()) return <Editor login="dev" dev />

  const cfg = editConfig()
  if (!cfg) notFound()

  const session = await unseal((await cookies()).get(COOKIE)?.value, cfg.secret)

  if (session && session.userId !== cfg.allowedUserId)
    return (
      <div className="ed ed-gate" data-scroll-page>
        <div className="ed-gate__card">
          <h1>{editCopy.denied.title}</h1>
          <p>{editCopy.denied.body}</p>
          <Link className="ed-btn" href="/">
            {editCopy.denied.home}
          </Link>
        </div>
      </div>
    )

  if (!session)
    return (
      <div className="ed ed-gate" data-scroll-page>
        <div className="ed-gate__card">
          <h1>{editCopy.signIn.title}</h1>
          <p>{editCopy.signIn.body}</p>
          <a className="ed-btn ed-btn--primary" href="/api/edit/auth/login">
            {editCopy.signIn.action}
          </a>
        </div>
      </div>
    )

  return <Editor login={session.login} dev={false} />
}
