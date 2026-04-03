CREATE INDEX "comments_project_id_deleted_at_idx" ON "comments" USING btree ("project_id","deleted_at");--> statement-breakpoint
CREATE INDEX "comments_project_id_version_id_idx" ON "comments" USING btree ("project_id","version_id");--> statement-breakpoint
CREATE INDEX "file_versions_file_id_commit_date_idx" ON "file_versions" USING btree ("file_id","commit_date");--> statement-breakpoint
CREATE INDEX "project_files_project_id_active_idx" ON "project_files" USING btree ("project_id","active");