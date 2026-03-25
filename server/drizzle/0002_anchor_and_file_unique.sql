ALTER TABLE "comments" ALTER COLUMN "css_selector" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "comments" ADD COLUMN "anchor_json" jsonb;--> statement-breakpoint
ALTER TABLE "project_files" ADD CONSTRAINT "project_files_project_path_unique" UNIQUE("project_id","path");