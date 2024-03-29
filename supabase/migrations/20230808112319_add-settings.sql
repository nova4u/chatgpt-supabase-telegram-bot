create table "public"."settings" (
    "id" bigint generated by default as identity not null,
    "user_id" bigint,
    "settings" json
);


CREATE UNIQUE INDEX settings_pkey ON public.settings USING btree (id);

alter table "public"."settings" add constraint "settings_pkey" PRIMARY KEY using index "settings_pkey";


