CREATE TABLE IF NOT EXISTS fare_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  value INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'CLP',
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  effective_from TEXT NOT NULL,
  effective_until TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(type, effective_from)
);

CREATE TABLE IF NOT EXISTS zone_fares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_from TEXT NOT NULL,
  zone_to TEXT NOT NULL,
  fare INTEGER NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(zone_from, zone_to)
);

CREATE INDEX IF NOT EXISTS idx_fare_settings_type   ON fare_settings(type);
CREATE INDEX IF NOT EXISTS idx_fare_settings_active ON fare_settings(is_active);
CREATE INDEX IF NOT EXISTS idx_zone_fares_zones     ON zone_fares(zone_from, zone_to);

INSERT INTO fare_settings (type, name, value, effective_from, description) VALUES
('mobility_base',       'Tarifa base movilidad',   300000, '2025-01-01', 'Tarifa base fija para cada viaje en centavos CLP'),
('mobility_per_km',     'Tarifa por kilómetro',     230000, '2025-01-01', 'Precio por km en centavos CLP (equivale a $2.300/km)'),
('minimum_fare',        'Tarifa mínima',            300000, '2025-01-01', 'Tarifa mínima por viaje en centavos CLP'),
('tour_base',           'Fee base tours',                0, '2025-01-01', 'Fee de plataforma para servicios turísticos (0 = sin fee)'),
('rental_base',         'Fee base arriendo',             0, '2025-01-01', 'Fee de plataforma para arriendos (0 = sin fee)'),
('discount_percentage', 'Descuento general',             0, '2025-01-01', 'Porcentaje de descuento general (0 = sin descuento)')
ON CONFLICT DO NOTHING;
