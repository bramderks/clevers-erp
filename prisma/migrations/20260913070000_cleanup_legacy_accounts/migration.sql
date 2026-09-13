-- One-time production cleanup of legacy employee/user accounts.
-- Keep only the three explicitly retained accounts:
--   Bram Derks
--   Jessica Derks
--   Test Medewerker

DELETE FROM "MedewerkerUitnodiging"
WHERE "email" NOT IN (
  'bram.derks@outlook.com',
  'j.derks@clevers.nl',
  'test.medewerker@clevers.nl'
);

DELETE FROM "Medewerker"
WHERE "email" <> 'test.medewerker@clevers.nl';

DELETE FROM "SysteemGebruiker"
WHERE "email" NOT IN (
  'bram.derks@outlook.com',
  'j.derks@clevers.nl',
  'test.medewerker@clevers.nl'
);
