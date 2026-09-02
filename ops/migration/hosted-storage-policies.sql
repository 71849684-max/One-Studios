drop policy if exists treasury_evidence_storage_read on storage.objects;
create policy treasury_evidence_storage_read on storage.objects
  for select to authenticated
  using(bucket_id='treasury-evidence' and marketing_app.ibm_has_permission('treasury.view'));

drop policy if exists treasury_evidence_storage_insert on storage.objects;
create policy treasury_evidence_storage_insert on storage.objects
  for insert to authenticated
  with check(
    bucket_id='treasury-evidence'
    and (storage.foldername(name))[1]=auth.uid()::text
    and (
      marketing_app.ibm_has_permission('treasury.record_payment') or
      marketing_app.ibm_has_permission('treasury.edit_movements')
    )
  );

drop policy if exists treasury_evidence_storage_delete_own on storage.objects;
create policy treasury_evidence_storage_delete_own on storage.objects
  for delete to authenticated
  using(
    bucket_id='treasury-evidence'
    and (storage.foldername(name))[1]=auth.uid()::text
    and (
      marketing_app.ibm_has_permission('treasury.record_payment') or
      marketing_app.ibm_has_permission('treasury.edit_movements')
    )
  );
