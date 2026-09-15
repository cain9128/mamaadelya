-- Migration: delete albums (v1) and their related images only
-- Deletes rows from public.albums and public.album_photos.
-- Does NOT touch: profiles, preview_generations (rows preserved, album_id set to NULL via FK), payments, storage buckets, code, files.
-- album_photos rows are removed automatically via ON DELETE CASCADE, explicit delete added for safety.

-- Related images of albums:
DELETE FROM public.album_photos;

-- Albums themselves:
DELETE FROM public.albums;
