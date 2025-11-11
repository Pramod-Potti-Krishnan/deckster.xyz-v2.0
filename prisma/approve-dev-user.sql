-- Approve the dev user account (pramodpotti@gmail.com)
UPDATE auth_users
SET
    approved = true,
    approved_at = NOW(),
    approved_by = 'dev-bypass-manual'
WHERE email = 'pramodpotti@gmail.com';

-- Verify the update
SELECT
    email,
    approved,
    approved_at,
    approved_by
FROM auth_users
WHERE email = 'pramodpotti@gmail.com';
