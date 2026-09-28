import { json } from '@/lib/edit/respond'
import { editRoute } from '@/lib/edit/route'
import { history } from '@/lib/edit/service'

export const dynamic = 'force-dynamic'

export const GET = editRoute(false, async (git) => json(await history(git)))
