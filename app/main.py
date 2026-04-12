from fastapi import FastAPI, HTTPException, Body
from pydantic import BaseModel
from typing import List, Optional
import os
from supabase import create_client, Client
from app.services.billing import FacturaDirectaClient
from dotenv import load_dotenv

from pathlib import Path

env_path = Path('.') / 'server' / '.env'
if not env_path.exists():
    env_path = Path('..') / 'server' / '.env'

load_dotenv(dotenv_path=env_path if env_path.exists() else None)
# Fallback to standard load if specific path fails
load_dotenv()

app = FastAPI(title="Billing Service", version="1.0.0")

from fastapi.middleware.cors import CORSMiddleware
import re as _re

# Only allow explicitly configured origins — never wildcard in production
_raw_origins = os.environ.get("ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:3000")
ALLOWED_ORIGINS = [o.strip() for o in _raw_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)

# Supabase Client
url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
supabase: Client = create_client(url, key)

# Initialize Billing Client
billing_client = FacturaDirectaClient()

class InvoiceItem(BaseModel):
    name: str
    price: float
    treatment_id: Optional[str] = None

class InvoiceRequest(BaseModel):
    patient_id: str
    items: List[InvoiceItem]
    payment_method: str = "card" # card, cash, transfer
    type: str = "invoice" # invoice, rectificative

@app.get("/")
def read_root():
    return {"status": "Billing Service Online", "env": "Sandbox" if billing_client.is_sandbox else "Production"}

@app.post("/invoices/emit")
def emit_invoice(payload: InvoiceRequest):
    try:
        print(f"📡 Recibida solicitud de factura para paciente: {payload.patient_id}")
        
        # 1. Fetch Patient Data from Supabase
        response = supabase.table("Patient").select("*").eq("id", payload.patient_id).execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="Paciente no encontrado en base de datos")
            
        patient = response.data[0]
        
        # 2. Sync Patient with FacturaDirecta
        fd_contact_id = billing_client.sync_patient(patient)
        if not fd_contact_id:
             raise HTTPException(status_code=500, detail="Error sincronizando contacto con FacturaDirecta")

        # 3. Create Invoice
        invoice_items = [{"name": i.name, "price": i.price} for i in payload.items]
        result = billing_client.create_invoice(fd_contact_id, invoice_items, payload.type)
        
        # 4. Save to Supabase Invoice Table
        invoice_data = {
            "invoiceNumber": result["invoice_number"],
            "amount": sum(i.price for i in payload.items),
            "status": "issued",
            "date": "now()", # Let Supabase handle time or send ISO string
            "url": result["pdf_url"],
            "patientId": payload.patient_id,
            # "items": ... # Prisma handles this relationally usually, dependent on schema.
            # If we were using Prisma directly in No we would create relations.
            # With Supabase pure REST, we insert valid row.
        }
        
        # Insert Invoice Record
        ins_res = supabase.table("Invoice").insert(invoice_data).execute()
        
        # NOTE: If we need to link treatments or save items details relationally, we should do that here too.
        # Assuming simple Invoice record for now as per requirements "Guarda en nuestra tabla local Invoices".
        
        return result

    except Exception as e:
        print(f"🔥 Error en endpoint /invoices/emit: {e}")
        raise HTTPException(status_code=500, detail=str(e))
