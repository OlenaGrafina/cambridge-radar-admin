import {CheckmarkIcon} from '@sanity/icons/Checkmark'
import {CloseIcon} from '@sanity/icons/Close'
import {WarningOutlineIcon} from '@sanity/icons/WarningOutline'
import {useState} from 'react'
import {type DocumentActionComponent, type DocumentActionProps, useDocumentOperation} from 'sanity'

/**
 * One-click moderation: set the status and publish in a single step, so the
 * editor never has to remember to press Publish after changing a dropdown.
 */
function makeStatusAction(
  status: 'approved' | 'rejected' | 'spam',
  label: string,
  icon: typeof CheckmarkIcon,
  tone: 'positive' | 'caution' | 'critical',
): DocumentActionComponent {
  const Action: DocumentActionComponent = (props: DocumentActionProps) => {
    const {patch, publish} = useDocumentOperation(props.id, props.type)
    const [busy, setBusy] = useState(false)
    const current = (props.draft ?? props.published) as {status?: string} | null

    if (current?.status === status) return null

    return {
      label: busy ? 'Saving…' : label,
      icon,
      tone,
      disabled: busy || Boolean(publish.disabled && publish.disabled !== 'ALREADY_PUBLISHED'),
      onHandle: () => {
        setBusy(true)
        patch.execute([{set: {status}}])
        publish.execute()
        props.onComplete()
      },
    }
  }
  Action.displayName = `CommentAction_${status}`
  return Action
}

export const approveComment = makeStatusAction('approved', 'Approve', CheckmarkIcon, 'positive')
export const rejectComment = makeStatusAction('rejected', 'Reject', CloseIcon, 'caution')
export const spamComment = makeStatusAction('spam', 'Mark as spam', WarningOutlineIcon, 'critical')
