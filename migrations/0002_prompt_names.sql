-- A short display name per prompt ("Pelican on a bicycle"), shown on the
-- Gallery's prompt tabs; the brief stays the prompt the models were given.
ALTER TABLE prompts ADD COLUMN name TEXT;
