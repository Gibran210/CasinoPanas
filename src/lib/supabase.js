import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://axvsroohiizncgqnlesh.supabase.co'
const SUPABASE_KEY = 'sb_publishable_cZUIOCWkMMYfzs7OX4nvKw_2eGNHxji'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)