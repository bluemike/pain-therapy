/**
 * Where a link leads after the date of birth: «Dokumente» for a document email (`?tab=dokumente`, iteration 12,
 * design D7), else home. Only known targets, so the link cannot send the patient anywhere else.
 */
export function landingOf(tab: unknown): '/' | '/dokumente' {
  return tab === 'dokumente' ? '/dokumente' : '/';
}
