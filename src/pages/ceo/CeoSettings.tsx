import { H1, Eyebrow, Card } from '@/components/ui'
import { CURRENT_SCHEMA_VERSION } from '@/lib/schema'

export function CeoSettings() {
  return (
    <div className="space-y-6">
      <Eyebrow>Settings</Eyebrow>
      <H1 className="chrome-text">CEO settings</H1>
      <Card>
        <div className="text-sm space-y-2">
          <div><span className="text-muted">Schema version:</span> {CURRENT_SCHEMA_VERSION}</div>
          <div><span className="text-muted">Frontend env:</span> {import.meta.env.MODE}</div>
          <div><span className="text-muted">Build:</span> {import.meta.env.VITE_APP_VERSION ?? 'dev'}</div>
        </div>
      </Card>
      <Card>
        <p className="text-sm text-muted">Use the Website CMS to update hero copy, mission text, and other customer-facing content without code changes. Use Audit Log to review sensitive operations. Use Secrets to manage platform credentials server-side.</p>
      </Card>
    </div>
  )
}