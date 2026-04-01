import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://pvyyaqxnjiklpmzbbruu.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB2eXlhcXhuamlrbHBtemJicnV1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2NDM0MDIsImV4cCI6MjA5MDIxOTQwMn0.QT1I_8wjRa0YzpQPUuN00dSzH4DXCJkqbZ08z9N_OEk';

const supabase = createClient(supabaseUrl, supabaseKey);

export default supabase
        