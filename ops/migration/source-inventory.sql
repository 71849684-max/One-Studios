select current_database() as database_name,
       current_setting('server_version') as postgres_version,
       pg_database_size(current_database()) as database_bytes;

select (select count(*) from auth.users) as auth_users,
       (select count(*) from auth.identities) as auth_identities,
       (select count(*) from marketing_app.members) as members,
       (select count(*) from marketing_app.clients) as clients,
       (select count(*) from marketing_app.campaigns) as campaigns,
       (select count(*) from marketing_app.tasks) as tasks,
       (select count(*) from marketing_app.messages) as messages,
       (select count(*) from marketing_app.posts) as posts,
       (select count(*) from marketing_app.treasury_contracts) as contracts,
       (select count(*) from marketing_app.treasury_installments) as installments,
       (select count(*) from marketing_app.treasury_movements) as movements,
       (select count(*) from public.interarea_requests) as requests,
       (select count(*) from marketing_app.roles) as roles,
       (select count(*) from marketing_app.role_permissions) as role_permissions,
       (select count(*) from storage.buckets) as storage_buckets,
       (select count(*) from storage.objects) as storage_objects;

select id as bucket_id, public, file_size_limit, allowed_mime_types
from storage.buckets
order by id;

select version
from supabase_migrations.schema_migrations
order by version;

select schemaname, tablename, policyname, roles, cmd
from pg_policies
where schemaname in ('marketing_app', 'public', 'storage')
order by schemaname, tablename, policyname;

select n.nspname as schema_name,
       p.proname as function_name,
       pg_get_function_identity_arguments(p.oid) as arguments
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname in ('marketing_app', 'public')
order by n.nspname, p.proname, arguments;
