-- Create Consent table in public schema
CREATE TABLE IF NOT EXISTS public.consent (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES public.patient(id) ON DELETE CASCADE,
    template_id VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    is_signed BOOLEAN DEFAULT false,
    signed_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_consent_patient FOREIGN KEY (patient_id) REFERENCES public.patient(id)
);

-- Create index on patient_id for faster queries
CREATE INDEX IF NOT EXISTS idx_consent_patient_id ON public.consent(patient_id);

-- Add RLS policies if needed
ALTER TABLE public.consent ENABLE ROW LEVEL SECURITY;
