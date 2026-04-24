CREATE TABLE "commit_files" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"commit_sha" varchar(40) NOT NULL,
	"path" text NOT NULL,
	"fetched_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "commit_files" ADD CONSTRAINT "commit_files_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "commit_files_project_sha_path_unique" ON "commit_files" USING btree ("project_id","commit_sha","path");--> statement-breakpoint
CREATE INDEX "commit_files_project_sha_idx" ON "commit_files" USING btree ("project_id","commit_sha");