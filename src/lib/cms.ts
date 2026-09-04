import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { cleanCmsValue } from './cleanText'

export type CmsValue = any

export function useCmsContent(key: string, fallback?: CmsValue) {
  const [value, setValue] = useState<CmsValue>(fallback)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const { data, error } = await supabase
          .from('page_content')
          .select('value')
          .eq('key', key)
          .maybeSingle()
        if (alive) {
          if (!error && data?.value) setValue(cleanCmsValue(data.value))
          setLoading(false)
        }
      } catch {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [key])
  return { value, loading }
}