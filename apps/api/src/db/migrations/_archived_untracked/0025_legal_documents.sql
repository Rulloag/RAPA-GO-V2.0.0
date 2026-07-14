CREATE TABLE IF NOT EXISTS legal_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,
  version TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  effective_date TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_acceptances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  legal_document_id UUID NOT NULL REFERENCES legal_documents(id),
  version_accepted TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  accepted_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, legal_document_id)
);

CREATE INDEX IF NOT EXISTS idx_legal_documents_type   ON legal_documents(type);
CREATE INDEX IF NOT EXISTS idx_legal_documents_active ON legal_documents(is_active);
CREATE INDEX IF NOT EXISTS idx_user_acceptances_user  ON user_acceptances(user_id);
CREATE INDEX IF NOT EXISTS idx_user_acceptances_doc   ON user_acceptances(legal_document_id);

INSERT INTO legal_documents (type, version, title, content, effective_date) VALUES
('terms_and_conditions', '1.0', 'Términos y Condiciones', 'Este documento está en preparación. Será actualizado próximamente por el equipo legal de Rapa Go.', '2025-01-01'),
('privacy_policy', '1.0', 'Política de Privacidad', 'Este documento está en preparación. Será actualizado próximamente por el equipo legal de Rapa Go.', '2025-01-01'),
('intellectual_property', '1.0', 'Propiedad Intelectual', 'Este documento está en preparación. Será actualizado próximamente por el equipo legal de Rapa Go.', '2025-01-01'),
('software_license', '1.0', 'Licencia de Software', 'Este documento está en preparación. Será actualizado próximamente por el equipo legal de Rapa Go.', '2025-01-01'),
('data_providers', '1.0', 'Proveedores de Datos', 'Este documento está en preparación. Será actualizado próximamente por el equipo legal de Rapa Go.', '2025-01-01'),
('user_conditions', '1.0', 'Condiciones para Usuarios', 'Este documento está en preparación. Será actualizado próximamente por el equipo legal de Rapa Go.', '2025-01-01'),
('driver_conditions', '1.0', 'Condiciones para Conductores', 'Este documento está en preparación. Será actualizado próximamente por el equipo legal de Rapa Go.', '2025-01-01'),
('guide_conditions', '1.0', 'Condiciones para Guías', 'Este documento está en preparación. Será actualizado próximamente por el equipo legal de Rapa Go.', '2025-01-01'),
('event_conditions', '1.0', 'Condiciones para Eventos', 'Este documento está en preparación. Será actualizado próximamente por el equipo legal de Rapa Go.', '2025-01-01')
ON CONFLICT DO NOTHING;
