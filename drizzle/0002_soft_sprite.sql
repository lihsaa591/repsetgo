CREATE INDEX "exercise_logs_workout_log_id_idx" ON "exercise_logs" USING btree ("workout_log_id");--> statement-breakpoint
CREATE INDEX "sets_exercise_log_id_idx" ON "sets" USING btree ("exercise_log_id");--> statement-breakpoint
CREATE INDEX "workout_logs_user_id_idx" ON "workout_logs" USING btree ("user_id");