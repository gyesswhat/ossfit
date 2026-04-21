DROP INDEX "bookmarks_user_issue_unique";--> statement-breakpoint
ALTER TABLE "bookmarks" RENAME COLUMN "issue_url" TO "repo_url";--> statement-breakpoint
CREATE UNIQUE INDEX "bookmarks_user_repo_unique" ON "bookmarks" USING btree ("user_id","repo_url");
