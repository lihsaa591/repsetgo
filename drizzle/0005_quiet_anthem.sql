CREATE TABLE "app_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"registrations_open" boolean DEFAULT true NOT NULL
);
INSERT INTO "app_settings" ("registrations_open") VALUES (true);
