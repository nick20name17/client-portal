import { relations } from "drizzle-orm";
import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const companies = pgTable("companies", {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
        .defaultNow()
        .$onUpdate(() => new Date())
        .notNull(),
});

// Relations are defined here as stubs; full relations added in auth.ts and app.ts
// to avoid circular imports. companiesRelations is extended via mergeRelations pattern
// or just left here with the user/project back-references added via their own relation files.
export const companiesRelations = relations(companies, () => ({}));
