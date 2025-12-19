-- Remove the restrictive meal_type check constraint to allow 'restaurant' and 'home_cooked'
ALTER TABLE eating_out_logs DROP CONSTRAINT IF EXISTS eating_out_logs_meal_type_check;
