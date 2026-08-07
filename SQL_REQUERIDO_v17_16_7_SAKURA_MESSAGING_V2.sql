-- INBESTIGA Marketing Cloud v17.16.7
-- SAKURA MESSAGING · WHATSAPP-STYLE MULTIMEDIA & MESSAGE CONTROL V2
--
-- REQUIERE: la mensajería productiva existente y la RPC ibm_v33_send_message.
-- CONSERVA: Auth, miembros, RLS, notificaciones y flujo Realtime existente.
-- AÑADE:
--   * respuestas vinculadas;
--   * archivos y audios privados;
--   * reacciones sincronizadas;
--   * mensajes destacados sincronizados;
--   * eliminar solo para mí;
--   * editar mensajes propios durante 15 minutos;
--   * eliminar para todos durante 48 horas;
--   * lectura por conversación.
--
-- EJECUTAR UNA SOLA VEZ EN SUPABASE SQL EDITOR.

begin;

create extension if not exists pgcrypto;

do $$
begin
  if to_regclass('marketing_app.messages') is null then
    raise exception 'No existe marketing_app.messages. Instala primero la base productiva de INBESTIGA.';
  end if;
  if to_regprocedure('marketing_app.ibm_v33_send_message(uuid,text,boolean)') is null then
    raise exception 'No existe ibm_v33_send_message(uuid,text,boolean). Esta versión amplía la mensajería existente y no debe instalarse sobre una base incompleta.';
  end if;
end $$;

alter table marketing_app.messages
  add column if not exists reply_to_id uuid,
  add column if not exists edited_at timestamptz,
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid,
  add column if not exists message_type text not null default 'text',
  add column if not exists metadata jsonb not null default '{}'::jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid='marketing_app.messages'::regclass
      and conname='messages_reply_to_v17167_fk'
  ) then
    alter table marketing_app.messages
      add constraint messages_reply_to_v17167_fk
      foreign key(reply_to_id) references marketing_app.messages(id) on delete set null;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid='marketing_app.messages'::regclass
      and conname='messages_deleted_by_v17167_fk'
  ) then
    alter table marketing_app.messages
      add constraint messages_deleted_by_v17167_fk
      foreign key(deleted_by) references marketing_app.members(id) on delete set null;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid='marketing_app.messages'::regclass
      and conname='messages_type_v17167_check'
  ) then
    alter table marketing_app.messages
      add constraint messages_type_v17167_check
      check(message_type in ('text','mixed','audio','image','video','document'));
  end if;
end $$;

create index if not exists messages_reply_to_v17167_idx
  on marketing_app.messages(reply_to_id);
create index if not exists messages_deleted_v17167_idx
  on marketing_app.messages(deleted_at) where deleted_at is not null;

create table if not exists marketing_app.message_reactions_v17167(
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references marketing_app.messages(id) on delete cascade,
  member_id uuid not null references marketing_app.members(id) on delete cascade,
  reaction text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint message_reactions_v17167_unique unique(message_id,member_id),
  constraint message_reactions_v17167_value check(
    char_length(reaction) between 1 and 16
  )
);

create table if not exists marketing_app.message_attachments_v17167(
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references marketing_app.messages(id) on delete cascade,
  uploader_member_id uuid not null references marketing_app.members(id) on delete restrict,
  storage_path text not null unique,
  file_name text not null,
  mime_type text not null default 'application/octet-stream',
  file_size bigint not null default 0,
  kind text not null default 'document',
  duration_seconds numeric(10,2),
  created_at timestamptz not null default now(),
  constraint message_attachments_v17167_kind check(kind in ('audio','image','video','document')),
  constraint message_attachments_v17167_size check(file_size between 0 and 26214400)
);

create index if not exists message_attachments_v17167_message_idx
  on marketing_app.message_attachments_v17167(message_id,created_at);

create table if not exists marketing_app.message_user_state_v17167(
  message_id uuid not null references marketing_app.messages(id) on delete cascade,
  member_id uuid not null references marketing_app.members(id) on delete cascade,
  starred_at timestamptz,
  hidden_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key(message_id,member_id)
);

create index if not exists message_user_state_v17167_member_idx
  on marketing_app.message_user_state_v17167(member_id,updated_at desc);

create or replace function marketing_app.ibm_v367_actor_member_id()
returns uuid
language sql
stable
security definer
set search_path=marketing_app,public,auth
as $$
  select m.id
  from marketing_app.members m
  where m.auth_user_id=auth.uid()
    and coalesce(m.status,'active')='active'
  limit 1
$$;

create or replace function marketing_app.ibm_v367_can_access_message(p_message_id uuid)
returns boolean
language sql
stable
security definer
set search_path=marketing_app,public,auth
as $$
  select exists(
    select 1
    from marketing_app.messages msg
    where msg.id=p_message_id
      and marketing_app.ibm_v367_actor_member_id() in (msg.sender_id,msg.recipient_id)
  )
$$;

-- El trigger permite identificar de forma inequívoca el mensaje creado por
-- ibm_v33_send_message sin reemplazar su lógica de notificación.
create or replace function marketing_app.ibm_v367_stamp_message()
returns trigger
language plpgsql
security definer
set search_path=marketing_app,public
as $$
declare
  v_token text;
begin
  v_token:=nullif(current_setting('inbestiga.message_client_token',true),'');
  if v_token is not null then
    new.metadata:=coalesce(new.metadata,'{}'::jsonb)||jsonb_build_object('client_token',v_token);
  end if;
  return new;
end
$$;

drop trigger if exists messages_stamp_v17167 on marketing_app.messages;
create trigger messages_stamp_v17167
before insert on marketing_app.messages
for each row execute function marketing_app.ibm_v367_stamp_message();

create or replace function marketing_app.ibm_v367_send_message(
  p_recipient_id uuid,
  p_text_content text default '',
  p_is_urgent boolean default false,
  p_reply_to_id uuid default null,
  p_client_token uuid default gen_random_uuid(),
  p_attachments jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path=marketing_app,public,auth
as $$
declare
  v_actor uuid;
  v_message marketing_app.messages%rowtype;
  v_item jsonb;
  v_path text;
  v_name text;
  v_mime text;
  v_kind text;
  v_size bigint;
  v_duration numeric;
  v_count integer;
  v_total bigint:=0;
  v_text text;
begin
  if auth.uid() is null then
    raise exception 'Se requiere una sesión autenticada.' using errcode='42501';
  end if;

  v_actor:=marketing_app.ibm_v367_actor_member_id();
  if v_actor is null then
    raise exception 'No existe un miembro activo para esta sesión.' using errcode='42501';
  end if;

  if p_recipient_id is null or p_recipient_id=v_actor then
    raise exception 'Selecciona un destinatario válido.' using errcode='22023';
  end if;

  if not exists(
    select 1 from marketing_app.members
    where id=p_recipient_id and coalesce(status,'active')='active'
  ) then
    raise exception 'El destinatario no está disponible.' using errcode='23503';
  end if;

  if jsonb_typeof(coalesce(p_attachments,'[]'::jsonb))<>'array' then
    raise exception 'Los adjuntos deben enviarse como una lista.' using errcode='22023';
  end if;

  v_count:=jsonb_array_length(coalesce(p_attachments,'[]'::jsonb));
  if v_count>10 then
    raise exception 'Solo se permiten 10 archivos por mensaje.' using errcode='22023';
  end if;

  v_text:=left(btrim(coalesce(p_text_content,'')),12000);
  if v_text='' and v_count=0 then
    raise exception 'Escribe un mensaje o adjunta un archivo.' using errcode='22023';
  end if;
  if v_text='' then
    v_text:=case
      when exists(select 1 from jsonb_array_elements(p_attachments) x where x->>'kind'='audio')
        then '🎙️ Mensaje de voz'
      else '📎 Archivo adjunto'
    end;
  end if;

  if p_reply_to_id is not null and not exists(
    select 1 from marketing_app.messages msg
    where msg.id=p_reply_to_id
      and (
        (msg.sender_id=v_actor and msg.recipient_id=p_recipient_id)
        or
        (msg.sender_id=p_recipient_id and msg.recipient_id=v_actor)
      )
  ) then
    raise exception 'El mensaje citado no pertenece a esta conversación.' using errcode='42501';
  end if;

  perform set_config('inbestiga.message_client_token',p_client_token::text,true);
  perform marketing_app.ibm_v33_send_message(p_recipient_id,v_text,coalesce(p_is_urgent,false));

  select *
  into v_message
  from marketing_app.messages msg
  where msg.sender_id=v_actor
    and msg.recipient_id=p_recipient_id
    and msg.metadata->>'client_token'=p_client_token::text
  order by msg.created_at desc
  limit 1;

  if v_message.id is null then
    raise exception 'El mensaje se envió, pero no pudo vincularse con sus recursos.' using errcode='P0001';
  end if;

  update marketing_app.messages
  set reply_to_id=p_reply_to_id,
      message_type=case
        when v_count=0 then 'text'
        when v_text in ('🎙️ Mensaje de voz','📎 Archivo adjunto')
          and exists(select 1 from jsonb_array_elements(p_attachments) x where x->>'kind'='audio')
          then 'audio'
        else 'mixed'
      end
  where id=v_message.id
  returning * into v_message;

  for v_item in select value from jsonb_array_elements(coalesce(p_attachments,'[]'::jsonb))
  loop
    v_path:=left(coalesce(v_item->>'storage_path',''),900);
    v_name:=left(coalesce(v_item->>'file_name','archivo'),240);
    v_mime:=left(coalesce(v_item->>'mime_type','application/octet-stream'),160);
    v_kind:=lower(coalesce(v_item->>'kind','document'));
    v_size:=greatest(0,coalesce((v_item->>'file_size')::bigint,0));
    v_duration:=nullif(v_item->>'duration_seconds','')::numeric;

    if v_kind not in ('audio','image','video','document') then
      raise exception 'Tipo de archivo no permitido: %',v_kind using errcode='22023';
    end if;
    if v_size>26214400 then
      raise exception 'Cada archivo debe pesar 25 MB o menos.' using errcode='22023';
    end if;
    v_total:=v_total+v_size;
    if v_total>78643200 then
      raise exception 'El mensaje supera el límite total de 75 MB.' using errcode='22023';
    end if;
    if v_path not like v_actor::text||'/'||p_client_token::text||'/%' then
      raise exception 'La ruta del archivo no corresponde al remitente.' using errcode='42501';
    end if;

    insert into marketing_app.message_attachments_v17167(
      message_id,uploader_member_id,storage_path,file_name,mime_type,
      file_size,kind,duration_seconds
    ) values(
      v_message.id,v_actor,v_path,v_name,v_mime,v_size,v_kind,v_duration
    );
  end loop;

  return jsonb_build_object(
    'message',to_jsonb(v_message),
    'attachment_count',v_count,
    'client_token',p_client_token
  );
end
$$;

create or replace function marketing_app.ibm_v367_toggle_message_reaction(
  p_message_id uuid,
  p_reaction text
)
returns jsonb
language plpgsql
security definer
set search_path=marketing_app,public,auth
as $$
declare
  v_actor uuid;
  v_reaction text:=left(btrim(coalesce(p_reaction,'')),16);
begin
  v_actor:=marketing_app.ibm_v367_actor_member_id();
  if v_actor is null or not marketing_app.ibm_v367_can_access_message(p_message_id) then
    raise exception 'No tienes acceso a este mensaje.' using errcode='42501';
  end if;
  if v_reaction='' then
    raise exception 'Selecciona una reacción.' using errcode='22023';
  end if;

  if exists(
    select 1 from marketing_app.message_reactions_v17167
    where message_id=p_message_id and member_id=v_actor and reaction=v_reaction
  ) then
    delete from marketing_app.message_reactions_v17167
    where message_id=p_message_id and member_id=v_actor;
  else
    insert into marketing_app.message_reactions_v17167(message_id,member_id,reaction)
    values(p_message_id,v_actor,v_reaction)
    on conflict(message_id,member_id)
    do update set reaction=excluded.reaction,updated_at=now();
  end if;

  return coalesce((
    select jsonb_agg(to_jsonb(r) order by r.created_at)
    from marketing_app.message_reactions_v17167 r
    where r.message_id=p_message_id
  ),'[]'::jsonb);
end
$$;

create or replace function marketing_app.ibm_v367_edit_message(
  p_message_id uuid,
  p_text_content text
)
returns jsonb
language plpgsql
security definer
set search_path=marketing_app,public,auth
as $$
declare
  v_actor uuid;
  v_message marketing_app.messages%rowtype;
  v_text text:=left(btrim(coalesce(p_text_content,'')),12000);
begin
  v_actor:=marketing_app.ibm_v367_actor_member_id();
  select * into v_message from marketing_app.messages where id=p_message_id for update;

  if v_message.id is null or v_message.sender_id<>v_actor then
    raise exception 'Solo puedes editar tus propios mensajes.' using errcode='42501';
  end if;
  if v_message.deleted_at is not null then
    raise exception 'Este mensaje ya fue eliminado.' using errcode='22023';
  end if;
  if now()>v_message.created_at+interval '15 minutes' then
    raise exception 'El tiempo para editar este mensaje terminó.' using errcode='22023';
  end if;
  if v_text='' and not exists(
    select 1 from marketing_app.message_attachments_v17167 where message_id=p_message_id
  ) then
    raise exception 'El mensaje no puede quedar vacío.' using errcode='22023';
  end if;

  update marketing_app.messages
  set text_content=v_text,edited_at=now()
  where id=p_message_id
  returning * into v_message;

  return to_jsonb(v_message);
end
$$;

create or replace function marketing_app.ibm_v367_delete_message_everyone(
  p_message_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path=marketing_app,public,auth
as $$
declare
  v_actor uuid;
  v_message marketing_app.messages%rowtype;
begin
  v_actor:=marketing_app.ibm_v367_actor_member_id();
  select * into v_message from marketing_app.messages where id=p_message_id for update;

  if v_message.id is null or v_message.sender_id<>v_actor then
    raise exception 'Solo puedes eliminar para todos tus propios mensajes.' using errcode='42501';
  end if;
  if now()>v_message.created_at+interval '48 hours' then
    raise exception 'El tiempo para eliminar este mensaje para todos terminó.' using errcode='22023';
  end if;

  update marketing_app.messages
  set text_content='',
      deleted_at=coalesce(deleted_at,now()),
      deleted_by=v_actor,
      edited_at=null
  where id=p_message_id
  returning * into v_message;

  return jsonb_build_object(
    'message',to_jsonb(v_message),
    'storage_paths',coalesce((
      select jsonb_agg(a.storage_path)
      from marketing_app.message_attachments_v17167 a
      where a.message_id=p_message_id
    ),'[]'::jsonb)
  );
end
$$;

create or replace function marketing_app.ibm_v367_set_message_state(
  p_message_id uuid,
  p_starred boolean default null,
  p_hidden boolean default null
)
returns jsonb
language plpgsql
security definer
set search_path=marketing_app,public,auth
as $$
declare
  v_actor uuid;
  v_state marketing_app.message_user_state_v17167%rowtype;
begin
  v_actor:=marketing_app.ibm_v367_actor_member_id();
  if v_actor is null or not marketing_app.ibm_v367_can_access_message(p_message_id) then
    raise exception 'No tienes acceso a este mensaje.' using errcode='42501';
  end if;

  insert into marketing_app.message_user_state_v17167(
    message_id,member_id,starred_at,hidden_at,updated_at
  ) values(
    p_message_id,v_actor,
    case when p_starred is true then now() else null end,
    case when p_hidden is true then now() else null end,
    now()
  )
  on conflict(message_id,member_id)
  do update set
    starred_at=case
      when p_starred is null then marketing_app.message_user_state_v17167.starred_at
      when p_starred then now()
      else null
    end,
    hidden_at=case
      when p_hidden is null then marketing_app.message_user_state_v17167.hidden_at
      when p_hidden then now()
      else null
    end,
    updated_at=now()
  returning * into v_state;

  return to_jsonb(v_state);
end
$$;

create or replace function marketing_app.ibm_v367_mark_thread_read(
  p_partner_id uuid
)
returns integer
language plpgsql
security definer
set search_path=marketing_app,public,auth
as $$
declare
  v_actor uuid;
  v_count integer;
begin
  v_actor:=marketing_app.ibm_v367_actor_member_id();
  if v_actor is null then
    raise exception 'No existe un miembro activo para esta sesión.' using errcode='42501';
  end if;

  update marketing_app.messages
  set read_at=coalesce(read_at,now())
  where recipient_id=v_actor
    and sender_id=p_partner_id
    and read_at is null;

  get diagnostics v_count=row_count;
  return v_count;
end
$$;

alter table marketing_app.message_reactions_v17167 enable row level security;
alter table marketing_app.message_attachments_v17167 enable row level security;
alter table marketing_app.message_user_state_v17167 enable row level security;

drop policy if exists message_reactions_v17167_select on marketing_app.message_reactions_v17167;
create policy message_reactions_v17167_select
on marketing_app.message_reactions_v17167
for select to authenticated
using(marketing_app.ibm_v367_can_access_message(message_id));

drop policy if exists message_reactions_v17167_write on marketing_app.message_reactions_v17167;
create policy message_reactions_v17167_write
on marketing_app.message_reactions_v17167
for all to authenticated
using(
  member_id=marketing_app.ibm_v367_actor_member_id()
  and marketing_app.ibm_v367_can_access_message(message_id)
)
with check(
  member_id=marketing_app.ibm_v367_actor_member_id()
  and marketing_app.ibm_v367_can_access_message(message_id)
);

drop policy if exists message_attachments_v17167_select on marketing_app.message_attachments_v17167;
create policy message_attachments_v17167_select
on marketing_app.message_attachments_v17167
for select to authenticated
using(marketing_app.ibm_v367_can_access_message(message_id));

drop policy if exists message_state_v17167_select on marketing_app.message_user_state_v17167;
create policy message_state_v17167_select
on marketing_app.message_user_state_v17167
for select to authenticated
using(member_id=marketing_app.ibm_v367_actor_member_id());

drop policy if exists message_state_v17167_write on marketing_app.message_user_state_v17167;
create policy message_state_v17167_write
on marketing_app.message_user_state_v17167
for all to authenticated
using(
  member_id=marketing_app.ibm_v367_actor_member_id()
  and marketing_app.ibm_v367_can_access_message(message_id)
)
with check(
  member_id=marketing_app.ibm_v367_actor_member_id()
  and marketing_app.ibm_v367_can_access_message(message_id)
);

insert into storage.buckets(id,name,public,file_size_limit)
values('inbestiga-message-files','inbestiga-message-files',false,26214400)
on conflict(id) do update
set public=false,file_size_limit=26214400;

drop policy if exists inbestiga_message_files_insert_v17167 on storage.objects;
create policy inbestiga_message_files_insert_v17167
on storage.objects
for insert to authenticated
with check(
  bucket_id='inbestiga-message-files'
  and split_part(name,'/',1)=marketing_app.ibm_v367_actor_member_id()::text
);

drop policy if exists inbestiga_message_files_select_v17167 on storage.objects;
create policy inbestiga_message_files_select_v17167
on storage.objects
for select to authenticated
using(
  bucket_id='inbestiga-message-files'
  and exists(
    select 1
    from marketing_app.message_attachments_v17167 a
    join marketing_app.messages msg on msg.id=a.message_id
    where a.storage_path=storage.objects.name
      and marketing_app.ibm_v367_actor_member_id() in (msg.sender_id,msg.recipient_id)
      and msg.deleted_at is null
  )
);

drop policy if exists inbestiga_message_files_delete_v17167 on storage.objects;
create policy inbestiga_message_files_delete_v17167
on storage.objects
for delete to authenticated
using(
  bucket_id='inbestiga-message-files'
  and split_part(name,'/',1)=marketing_app.ibm_v367_actor_member_id()::text
);

revoke all on function marketing_app.ibm_v367_actor_member_id() from public,anon;
revoke all on function marketing_app.ibm_v367_can_access_message(uuid) from public,anon;
revoke all on function marketing_app.ibm_v367_send_message(uuid,text,boolean,uuid,uuid,jsonb) from public,anon;
revoke all on function marketing_app.ibm_v367_toggle_message_reaction(uuid,text) from public,anon;
revoke all on function marketing_app.ibm_v367_edit_message(uuid,text) from public,anon;
revoke all on function marketing_app.ibm_v367_delete_message_everyone(uuid) from public,anon;
revoke all on function marketing_app.ibm_v367_set_message_state(uuid,boolean,boolean) from public,anon;
revoke all on function marketing_app.ibm_v367_mark_thread_read(uuid) from public,anon;

grant execute on function marketing_app.ibm_v367_actor_member_id() to authenticated;
grant execute on function marketing_app.ibm_v367_can_access_message(uuid) to authenticated;
grant execute on function marketing_app.ibm_v367_send_message(uuid,text,boolean,uuid,uuid,jsonb) to authenticated;
grant execute on function marketing_app.ibm_v367_toggle_message_reaction(uuid,text) to authenticated;
grant execute on function marketing_app.ibm_v367_edit_message(uuid,text) to authenticated;
grant execute on function marketing_app.ibm_v367_delete_message_everyone(uuid) to authenticated;
grant execute on function marketing_app.ibm_v367_set_message_state(uuid,boolean,boolean) to authenticated;
grant execute on function marketing_app.ibm_v367_mark_thread_read(uuid) to authenticated;

grant select on marketing_app.message_reactions_v17167 to authenticated;
grant select on marketing_app.message_attachments_v17167 to authenticated;
grant select on marketing_app.message_user_state_v17167 to authenticated;

do $$
begin
  begin
    alter publication supabase_realtime add table marketing_app.message_reactions_v17167;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table marketing_app.message_attachments_v17167;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table marketing_app.message_user_state_v17167;
  exception when duplicate_object then null;
  end;
end $$;

commit;

select
  'SAKURA_MESSAGING_V2_INSTALADO' as estado,
  to_regclass('marketing_app.message_reactions_v17167') is not null as reacciones,
  to_regclass('marketing_app.message_attachments_v17167') is not null as adjuntos,
  to_regclass('marketing_app.message_user_state_v17167') is not null as estados,
  exists(select 1 from storage.buckets where id='inbestiga-message-files') as storage_privado;
