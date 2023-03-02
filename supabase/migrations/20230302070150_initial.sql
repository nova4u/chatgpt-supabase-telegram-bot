create table "public"."dialogues" (
    "id" bigint generated by default as identity not null,
    "user_id" bigint,
    "created_at" timestamp with time zone default now(),
    "message" json
);


CREATE UNIQUE INDEX dialogues_pkey ON public.dialogues USING btree (id);

alter table "public"."dialogues" add constraint "dialogues_pkey" PRIMARY KEY using index "dialogues_pkey";


