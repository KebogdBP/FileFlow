CREATE TABLE `site_totals` (
  `id` integer PRIMARY KEY NOT NULL,
  `count` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `visit_counts` (
  `day` text PRIMARY KEY NOT NULL,
  `count` integer DEFAULT 0 NOT NULL
);
