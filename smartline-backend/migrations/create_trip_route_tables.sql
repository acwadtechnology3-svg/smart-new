-- Create table for storing raw trip route points
CREATE TABLE IF NOT EXISTS trip_route_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  heading INTEGER, -- 0-360 degrees
  speed DECIMAL(5, 2), -- km/h
  accuracy DECIMAL(6, 2), -- meters
  recorded_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for efficient querying of route points
CREATE INDEX IF NOT EXISTS idx_trip_route_points_trip_id ON trip_route_points(trip_id);
CREATE INDEX IF NOT EXISTS idx_trip_route_points_recorded_at ON trip_route_points(recorded_at);
CREATE INDEX IF NOT EXISTS idx_trip_route_points_trip_recorded ON trip_route_points(trip_id, recorded_at);

-- Create table for storing trip summaries (calculated after trip completion)
CREATE TABLE IF NOT EXISTS trip_route_summary (
  trip_id UUID PRIMARY KEY REFERENCES trips(id) ON DELETE CASCADE,
  total_distance DECIMAL(10, 2), -- km
  total_duration INTEGER, -- seconds
  points_count INTEGER,
  start_location GEOMETRY(Point, 4326),
  end_location GEOMETRY(Point, 4326),
  route_line GEOMETRY(LineString, 4326),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sample INSERT query for route points
-- INSERT INTO trip_route_points (trip_id, latitude, longitude, heading, speed, accuracy, recorded_at)
-- VALUES ('trip-uuid', 30.0444, 31.2357, 180, 25.5, 10.0, '2024-02-13T10:30:00Z');

-- Query to fetch trip route ordered by time
-- SELECT latitude, longitude, heading, speed, accuracy, recorded_at 
-- FROM trip_route_points 
-- WHERE trip_id = 'trip-uuid' 
-- ORDER BY recorded_at ASC;
