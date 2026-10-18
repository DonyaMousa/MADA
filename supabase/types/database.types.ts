
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "admin_audit_logs": {
                  Row: {
                    "action": string,"actor_id": string | null,"created_at": string,"detail": NonNullable<Json>,"entity_id": string | null,"entity_type": string,"id": number
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"created_at"?: string,"detail"?: NonNullable<Json>,"entity_id"?: string | null,"entity_type": string,"id"?: never
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"created_at"?: string,"detail"?: NonNullable<Json>,"entity_id"?: string | null,"entity_type"?: string,"id"?: never
                  }
                  Relationships: [
                    
                  ]
                },"application_tasks": {
                  Row: {
                    "application_id": string,"created_at": string,"done": boolean,"id": string,"title": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "application_id": string,"created_at"?: string,"done"?: boolean,"id"?: string,"title": string,"user_id": string
                  }
                  Update: {
                    "application_id"?: string,"created_at"?: string,"done"?: boolean,"id"?: string,"title"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "application_tasks_application_id_fkey"
      columns: ["application_id"]
isOneToOne: false
      referencedRelation: "applications"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "application_tasks_owner_fk"
      columns: ["application_id","user_id"]
isOneToOne: false
      referencedRelation: "applications"
      referencedColumns: ["id","user_id"]
    },{
      foreignKeyName: "application_tasks_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"applications": {
                  Row: {
                    "confirmation_reference": string | null,"created_at": string,"id": string,"notes": string | null,"official_deadline_at": string | null,"preparation_progress": number,"scholarship_id": string,"submitted_at": string | null,"updated_at": string,"user_id": string,"workspace_status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "confirmation_reference"?: string | null,"created_at"?: string,"id"?: string,"notes"?: string | null,"official_deadline_at"?: string | null,"preparation_progress"?: number,"scholarship_id": string,"submitted_at"?: string | null,"updated_at"?: string,"user_id": string,"workspace_status"?: string
                  }
                  Update: {
                    "confirmation_reference"?: string | null,"created_at"?: string,"id"?: string,"notes"?: string | null,"official_deadline_at"?: string | null,"preparation_progress"?: number,"scholarship_id"?: string,"submitted_at"?: string | null,"updated_at"?: string,"user_id"?: string,"workspace_status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "applications_scholarship_id_fkey"
      columns: ["scholarship_id"]
isOneToOne: false
      referencedRelation: "scholarships"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "applications_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"assistant_conversations": {
                  Row: {
                    "application_id": string | null,"created_at": string,"id": string,"include_attachments": boolean,"scholarship_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "application_id"?: string | null,"created_at"?: string,"id"?: string,"include_attachments"?: boolean,"scholarship_id": string,"user_id": string
                  }
                  Update: {
                    "application_id"?: string | null,"created_at"?: string,"id"?: string,"include_attachments"?: boolean,"scholarship_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "assistant_conversations_application_id_fkey"
      columns: ["application_id"]
isOneToOne: false
      referencedRelation: "applications"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "assistant_conversations_application_owner_fk"
      columns: ["application_id","user_id","scholarship_id"]
isOneToOne: false
      referencedRelation: "applications"
      referencedColumns: ["id","user_id","scholarship_id"]
    },{
      foreignKeyName: "assistant_conversations_scholarship_id_fkey"
      columns: ["scholarship_id"]
isOneToOne: false
      referencedRelation: "scholarships"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "assistant_conversations_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"assistant_messages": {
                  Row: {
                    "citations": NonNullable<Json>,"content": string,"conversation_id": string,"created_at": string,"id": number,"role": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "citations"?: NonNullable<Json>,"content": string,"conversation_id": string,"created_at"?: string,"id"?: never,"role": string,"user_id": string
                  }
                  Update: {
                    "citations"?: NonNullable<Json>,"content"?: string,"conversation_id"?: string,"created_at"?: string,"id"?: never,"role"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "assistant_messages_conversation_id_fkey"
      columns: ["conversation_id"]
isOneToOne: false
      referencedRelation: "assistant_conversations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "assistant_messages_owner_fk"
      columns: ["conversation_id","user_id"]
isOneToOne: false
      referencedRelation: "assistant_conversations"
      referencedColumns: ["id","user_id"]
    },{
      foreignKeyName: "assistant_messages_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"community_memberships": {
                  Row: {
                    "display_name": string,"joined_at": string,"scholarship_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "display_name": string,"joined_at"?: string,"scholarship_id": string,"user_id": string
                  }
                  Update: {
                    "display_name"?: string,"joined_at"?: string,"scholarship_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "community_memberships_scholarship_id_fkey"
      columns: ["scholarship_id"]
isOneToOne: false
      referencedRelation: "scholarships"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "community_memberships_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"community_posts": {
                  Row: {
                    "body": string,"channel": string,"created_at": string,"deleted": boolean,"id": string,"parent_id": string | null,"scholarship_id": string,"updated_at": string,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "body": string,"channel": string,"created_at"?: string,"deleted"?: boolean,"id"?: string,"parent_id"?: string | null,"scholarship_id": string,"updated_at"?: string,"user_id"?: string | null
                  }
                  Update: {
                    "body"?: string,"channel"?: string,"created_at"?: string,"deleted"?: boolean,"id"?: string,"parent_id"?: string | null,"scholarship_id"?: string,"updated_at"?: string,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "community_posts_parent_context_fk"
      columns: ["parent_id","scholarship_id","channel"]
isOneToOne: false
      referencedRelation: "community_posts"
      referencedColumns: ["id","scholarship_id","channel"]
    },{
      foreignKeyName: "community_posts_parent_id_fkey"
      columns: ["parent_id"]
isOneToOne: false
      referencedRelation: "community_posts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "community_posts_scholarship_id_fkey"
      columns: ["scholarship_id"]
isOneToOne: false
      referencedRelation: "scholarships"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "community_posts_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"community_rate_limits": {
                  Row: {
                    "id": number,"posted_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: never,"posted_at"?: string,"user_id": string
                  }
                  Update: {
                    "id"?: never,"posted_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "community_rate_limits_user_fk"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"community_reports": {
                  Row: {
                    "created_at": string,"id": string,"post_id": string,"reason": string,"reporter_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"post_id": string,"reason": string,"reporter_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"post_id"?: string,"reason"?: string,"reporter_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "community_reports_post_id_fkey"
      columns: ["post_id"]
isOneToOne: false
      referencedRelation: "community_posts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "community_reports_reporter_id_fkey"
      columns: ["reporter_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"contact_messages": {
                  Row: {
                    "created_at": string,"email": string,"id": string,"message": string,"name": string,"topic": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"email": string,"id"?: string,"message": string,"name": string,"topic": string
                  }
                  Update: {
                    "created_at"?: string,"email"?: string,"id"?: string,"message"?: string,"name"?: string,"topic"?: string
                  }
                  Relationships: [
                    
                  ]
                },"cv_extractions": {
                  Row: {
                    "completed_at": string | null,"confidence": number | null,"created_at": string,"document_id": string,"error_code": string | null,"extracted_text": string | null,"extractor_version": string,"id": string,"input_sha256": string,"model_provider": string,"model_version": string,"schema_version": string,"started_at": string | null,"status": string,"structured_data": NonNullable<Json>,"updated_at": string,"user_id": string,"warnings": NonNullable<Json>
                  }
                  ComputedFields: never
                  Insert: {
                    "completed_at"?: string | null,"confidence"?: number | null,"created_at"?: string,"document_id": string,"error_code"?: string | null,"extracted_text"?: string | null,"extractor_version": string,"id"?: string,"input_sha256": string,"model_provider": string,"model_version": string,"schema_version": string,"started_at"?: string | null,"status"?: string,"structured_data"?: NonNullable<Json>,"updated_at"?: string,"user_id": string,"warnings"?: NonNullable<Json>
                  }
                  Update: {
                    "completed_at"?: string | null,"confidence"?: number | null,"created_at"?: string,"document_id"?: string,"error_code"?: string | null,"extracted_text"?: string | null,"extractor_version"?: string,"id"?: string,"input_sha256"?: string,"model_provider"?: string,"model_version"?: string,"schema_version"?: string,"started_at"?: string | null,"status"?: string,"structured_data"?: NonNullable<Json>,"updated_at"?: string,"user_id"?: string,"warnings"?: NonNullable<Json>
                  }
                  Relationships: [
                    {
      foreignKeyName: "cv_extractions_document_id_user_id_fkey"
      columns: ["document_id","user_id"]
isOneToOne: false
      referencedRelation: "documents"
      referencedColumns: ["id","user_id"]
    },{
      foreignKeyName: "cv_extractions_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"document_attachments": {
                  Row: {
                    "application_id": string,"created_at": string,"document_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "application_id": string,"created_at"?: string,"document_id": string,"user_id": string
                  }
                  Update: {
                    "application_id"?: string,"created_at"?: string,"document_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "document_attachments_application_id_fkey"
      columns: ["application_id"]
isOneToOne: false
      referencedRelation: "applications"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "document_attachments_application_owner_fk"
      columns: ["application_id","user_id"]
isOneToOne: false
      referencedRelation: "applications"
      referencedColumns: ["id","user_id"]
    },{
      foreignKeyName: "document_attachments_document_id_fkey"
      columns: ["document_id"]
isOneToOne: false
      referencedRelation: "documents"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "document_attachments_document_owner_fk"
      columns: ["document_id","user_id"]
isOneToOne: false
      referencedRelation: "documents"
      referencedColumns: ["id","user_id"]
    },{
      foreignKeyName: "document_attachments_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"documents": {
                  Row: {
                    "byte_size": number,"created_at": string,"extracted_text": string | null,"id": string,"kind": string,"mime_type": string,"original_name": string,"safe_name": string,"storage_path": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "byte_size": number,"created_at"?: string,"extracted_text"?: string | null,"id"?: string,"kind": string,"mime_type": string,"original_name": string,"safe_name": string,"storage_path": string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "byte_size"?: number,"created_at"?: string,"extracted_text"?: string | null,"id"?: string,"kind"?: string,"mime_type"?: string,"original_name"?: string,"safe_name"?: string,"storage_path"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "documents_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"fetch_runs": {
                  Row: {
                    "error_detail": NonNullable<Json>,"fetched_count": number,"finished_at": string | null,"http_status": number | null,"id": string,"imported_count": number,"importer_version": string,"rejected_count": number,"source_id": string,"started_at": string,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "error_detail"?: NonNullable<Json>,"fetched_count"?: number,"finished_at"?: string | null,"http_status"?: number | null,"id"?: string,"imported_count"?: number,"importer_version": string,"rejected_count"?: number,"source_id": string,"started_at"?: string,"status"?: string
                  }
                  Update: {
                    "error_detail"?: NonNullable<Json>,"fetched_count"?: number,"finished_at"?: string | null,"http_status"?: number | null,"id"?: string,"imported_count"?: number,"importer_version"?: string,"rejected_count"?: number,"source_id"?: string,"started_at"?: string,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "fetch_runs_source_id_fkey"
      columns: ["source_id"]
isOneToOne: false
      referencedRelation: "scholarship_sources"
      referencedColumns: ["id"]
    }
                  ]
                },"help_articles": {
                  Row: {
                    "body_ar": string,"body_en": string,"id": string,"kind": string,"published": boolean,"slug": string,"title_ar": string,"title_en": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body_ar": string,"body_en": string,"id"?: string,"kind": string,"published"?: boolean,"slug": string,"title_ar": string,"title_en": string
                  }
                  Update: {
                    "body_ar"?: string,"body_en"?: string,"id"?: string,"kind"?: string,"published"?: boolean,"slug"?: string,"title_ar"?: string,"title_en"?: string
                  }
                  Relationships: [
                    
                  ]
                },"letter_drafts": {
                  Row: {
                    "application_id": string | null,"body": string,"created_at": string,"id": string,"scholarship_id": string,"title": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "application_id"?: string | null,"body"?: string,"created_at"?: string,"id"?: string,"scholarship_id": string,"title": string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "application_id"?: string | null,"body"?: string,"created_at"?: string,"id"?: string,"scholarship_id"?: string,"title"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "letter_drafts_application_id_fkey"
      columns: ["application_id"]
isOneToOne: false
      referencedRelation: "applications"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "letter_drafts_application_owner_fk"
      columns: ["application_id","user_id","scholarship_id"]
isOneToOne: false
      referencedRelation: "applications"
      referencedColumns: ["id","user_id","scholarship_id"]
    },{
      foreignKeyName: "letter_drafts_scholarship_id_fkey"
      columns: ["scholarship_id"]
isOneToOne: false
      referencedRelation: "scholarships"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "letter_drafts_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"letter_versions": {
                  Row: {
                    "body": string,"created_at": string,"id": number,"label": string | null,"letter_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body": string,"created_at"?: string,"id"?: never,"label"?: string | null,"letter_id": string,"user_id": string
                  }
                  Update: {
                    "body"?: string,"created_at"?: string,"id"?: never,"label"?: string | null,"letter_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "letter_versions_letter_id_fkey"
      columns: ["letter_id"]
isOneToOne: false
      referencedRelation: "letter_drafts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "letter_versions_owner_fk"
      columns: ["letter_id","user_id"]
isOneToOne: false
      referencedRelation: "letter_drafts"
      referencedColumns: ["id","user_id"]
    },{
      foreignKeyName: "letter_versions_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"matches": {
                  Row: {
                    "calculated_at": string,"cv_extraction_id": string | null,"eligibility_results": NonNullable<Json>,"eligibility_status": string,"eligibility_version": string,"explanation": NonNullable<Json>,"id": string,"input_fingerprint": string,"model_versions": NonNullable<Json>,"profile_updated_at": string,"scholarship_id": string,"scholarship_updated_at": string,"score_breakdown": NonNullable<Json>,"scorer_version": string,"total_score": number | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "calculated_at"?: string,"cv_extraction_id"?: string | null,"eligibility_results": NonNullable<Json>,"eligibility_status": string,"eligibility_version": string,"explanation": NonNullable<Json>,"id"?: string,"input_fingerprint": string,"model_versions": NonNullable<Json>,"profile_updated_at": string,"scholarship_id": string,"scholarship_updated_at": string,"score_breakdown": NonNullable<Json>,"scorer_version": string,"total_score"?: number | null,"user_id": string
                  }
                  Update: {
                    "calculated_at"?: string,"cv_extraction_id"?: string | null,"eligibility_results"?: NonNullable<Json>,"eligibility_status"?: string,"eligibility_version"?: string,"explanation"?: NonNullable<Json>,"id"?: string,"input_fingerprint"?: string,"model_versions"?: NonNullable<Json>,"profile_updated_at"?: string,"scholarship_id"?: string,"scholarship_updated_at"?: string,"score_breakdown"?: NonNullable<Json>,"scorer_version"?: string,"total_score"?: number | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "matches_cv_extraction_id_user_id_fkey"
      columns: ["cv_extraction_id","user_id"]
isOneToOne: false
      referencedRelation: "cv_extractions"
      referencedColumns: ["id","user_id"]
    },{
      foreignKeyName: "matches_scholarship_id_fkey"
      columns: ["scholarship_id"]
isOneToOne: false
      referencedRelation: "scholarships"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "matches_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"notifications": {
                  Row: {
                    "body": string,"created_at": string,"delivery_key": string | null,"id": string,"kind": string,"payload": NonNullable<Json>,"read": boolean,"scholarship_id": string | null,"title": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body": string,"created_at"?: string,"delivery_key"?: string | null,"id"?: string,"kind": string,"payload"?: NonNullable<Json>,"read"?: boolean,"scholarship_id"?: string | null,"title": string,"user_id": string
                  }
                  Update: {
                    "body"?: string,"created_at"?: string,"delivery_key"?: string | null,"id"?: string,"kind"?: string,"payload"?: NonNullable<Json>,"read"?: boolean,"scholarship_id"?: string | null,"title"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notifications_scholarship_id_fkey"
      columns: ["scholarship_id"]
isOneToOne: false
      referencedRelation: "scholarships"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notifications_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "citizenship": string | null,"created_at": string,"current_degree": string | null,"cv_extracted_suggestions": Json | null,"destination_preferences": (string)[],"display_name": string | null,"field_of_study": string | null,"funding_need": string | null,"gpa": number | null,"gpa_scale": number | null,"graduation_year": number | null,"id": string,"institution": string | null,"intended_degree": string | null,"language_tests": NonNullable<Json>,"locale": string,"relevant_experience": string | null,"research_interests": string | null,"residence_country": string | null,"timezone": string,"updated_at": string,"work_experience": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "citizenship"?: string | null,"created_at"?: string,"current_degree"?: string | null,"cv_extracted_suggestions"?: Json | null,"destination_preferences"?: (string)[],"display_name"?: string | null,"field_of_study"?: string | null,"funding_need"?: string | null,"gpa"?: number | null,"gpa_scale"?: number | null,"graduation_year"?: number | null,"id": string,"institution"?: string | null,"intended_degree"?: string | null,"language_tests"?: NonNullable<Json>,"locale"?: string,"relevant_experience"?: string | null,"research_interests"?: string | null,"residence_country"?: string | null,"timezone"?: string,"updated_at"?: string,"work_experience"?: string | null
                  }
                  Update: {
                    "citizenship"?: string | null,"created_at"?: string,"current_degree"?: string | null,"cv_extracted_suggestions"?: Json | null,"destination_preferences"?: (string)[],"display_name"?: string | null,"field_of_study"?: string | null,"funding_need"?: string | null,"gpa"?: number | null,"gpa_scale"?: number | null,"graduation_year"?: number | null,"id"?: string,"institution"?: string | null,"intended_degree"?: string | null,"language_tests"?: NonNullable<Json>,"locale"?: string,"relevant_experience"?: string | null,"research_interests"?: string | null,"residence_country"?: string | null,"timezone"?: string,"updated_at"?: string,"work_experience"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"provider_proposals": {
                  Row: {
                    "contact_email": string,"created_at": string,"id": string,"listing_title": string,"notes": string | null,"official_source_url": string,"organization": string,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "contact_email": string,"created_at"?: string,"id"?: string,"listing_title": string,"notes"?: string | null,"official_source_url": string,"organization": string,"status"?: string
                  }
                  Update: {
                    "contact_email"?: string,"created_at"?: string,"id"?: string,"listing_title"?: string,"notes"?: string | null,"official_source_url"?: string,"organization"?: string,"status"?: string
                  }
                  Relationships: [
                    
                  ]
                },"reminder_deliveries": {
                  Row: {
                    "application_id": string | null,"attempt_count": number,"channel": string,"created_at": string,"deadline_at": string,"detail": string | null,"id": number,"next_attempt_at": string | null,"reminder_days": number,"scheduled_for": string,"scholarship_id": string,"sent_at": string | null,"status": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "application_id"?: string | null,"attempt_count"?: number,"channel": string,"created_at"?: string,"deadline_at": string,"detail"?: string | null,"id"?: never,"next_attempt_at"?: string | null,"reminder_days": number,"scheduled_for": string,"scholarship_id": string,"sent_at"?: string | null,"status": string,"user_id": string
                  }
                  Update: {
                    "application_id"?: string | null,"attempt_count"?: number,"channel"?: string,"created_at"?: string,"deadline_at"?: string,"detail"?: string | null,"id"?: never,"next_attempt_at"?: string | null,"reminder_days"?: number,"scheduled_for"?: string,"scholarship_id"?: string,"sent_at"?: string | null,"status"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "reminder_deliveries_application_id_fkey"
      columns: ["application_id"]
isOneToOne: false
      referencedRelation: "applications"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reminder_deliveries_owner_fk"
      columns: ["application_id","user_id","scholarship_id"]
isOneToOne: false
      referencedRelation: "applications"
      referencedColumns: ["id","user_id","scholarship_id"]
    },{
      foreignKeyName: "reminder_deliveries_scholarship_id_fkey"
      columns: ["scholarship_id"]
isOneToOne: false
      referencedRelation: "scholarships"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reminder_deliveries_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"reminder_preferences": {
                  Row: {
                    "due_soon_days": number,"email": boolean,"in_app": boolean,"timezone": string,"upcoming_days": number,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "due_soon_days"?: number,"email"?: boolean,"in_app"?: boolean,"timezone"?: string,"upcoming_days"?: number,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "due_soon_days"?: number,"email"?: boolean,"in_app"?: boolean,"timezone"?: string,"upcoming_days"?: number,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "reminder_preferences_user_id_fkey"
      columns: ["user_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"saved_scholarships": {
                  Row: {
                    "created_at": string,"scholarship_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"scholarship_id": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"scholarship_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "saved_scholarships_scholarship_id_fkey"
      columns: ["scholarship_id"]
isOneToOne: false
      referencedRelation: "scholarships"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "saved_scholarships_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"scholarship_change_history": {
                  Row: {
                    "changed_at": string,"changed_by": string | null,"field_name": string,"id": number,"new_value": string | null,"old_value": string | null,"review_status": string,"scholarship_id": string,"source_url": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "changed_at"?: string,"changed_by"?: string | null,"field_name": string,"id"?: never,"new_value"?: string | null,"old_value"?: string | null,"review_status"?: string,"scholarship_id": string,"source_url"?: string | null
                  }
                  Update: {
                    "changed_at"?: string,"changed_by"?: string | null,"field_name"?: string,"id"?: never,"new_value"?: string | null,"old_value"?: string | null,"review_status"?: string,"scholarship_id"?: string,"source_url"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "scholarship_change_history_scholarship_id_fkey"
      columns: ["scholarship_id"]
isOneToOne: false
      referencedRelation: "scholarships"
      referencedColumns: ["id"]
    }
                  ]
                },"scholarship_deadlines": {
                  Row: {
                    "applicant_status": string | null,"certainty": string,"created_at": string,"cycle_label": string | null,"date": string | null,"deadline_at": string | null,"id": string,"kind": string,"original_text": string,"requires_human_review": boolean,"scholarship_id": string,"snapshot_id": string,"source_section": string,"source_url": string,"timezone": string | null,"variant_id": string | null,"year_explicit": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "applicant_status"?: string | null,"certainty": string,"created_at"?: string,"cycle_label"?: string | null,"date"?: string | null,"deadline_at"?: string | null,"id"?: string,"kind": string,"original_text": string,"requires_human_review"?: boolean,"scholarship_id": string,"snapshot_id": string,"source_section": string,"source_url": string,"timezone"?: string | null,"variant_id"?: string | null,"year_explicit"?: boolean
                  }
                  Update: {
                    "applicant_status"?: string | null,"certainty"?: string,"created_at"?: string,"cycle_label"?: string | null,"date"?: string | null,"deadline_at"?: string | null,"id"?: string,"kind"?: string,"original_text"?: string,"requires_human_review"?: boolean,"scholarship_id"?: string,"snapshot_id"?: string,"source_section"?: string,"source_url"?: string,"timezone"?: string | null,"variant_id"?: string | null,"year_explicit"?: boolean
                  }
                  Relationships: [
                    {
      foreignKeyName: "scholarship_deadlines_scholarship_id_fkey"
      columns: ["scholarship_id"]
isOneToOne: false
      referencedRelation: "scholarships"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "scholarship_deadlines_snapshot_fk"
      columns: ["snapshot_id","scholarship_id"]
isOneToOne: false
      referencedRelation: "scholarship_snapshots"
      referencedColumns: ["id","scholarship_id"]
    },{
      foreignKeyName: "scholarship_deadlines_variant_fk"
      columns: ["variant_id","scholarship_id","snapshot_id"]
isOneToOne: false
      referencedRelation: "scholarship_variants"
      referencedColumns: ["id","scholarship_id","snapshot_id"]
    }
                  ]
                },"scholarship_evidence": {
                  Row: {
                    "archive_storage_path": string | null,"content_sha256": string,"content_type": string | null,"created_at": string,"id": string,"method": string,"request_data": Json | null,"retrieved_at": string,"scholarship_id": string,"snapshot_id": string,"status_code": number,"url": string
                  }
                  ComputedFields: never
                  Insert: {
                    "archive_storage_path"?: string | null,"content_sha256": string,"content_type"?: string | null,"created_at"?: string,"id"?: string,"method": string,"request_data"?: Json | null,"retrieved_at": string,"scholarship_id": string,"snapshot_id": string,"status_code": number,"url": string
                  }
                  Update: {
                    "archive_storage_path"?: string | null,"content_sha256"?: string,"content_type"?: string | null,"created_at"?: string,"id"?: string,"method"?: string,"request_data"?: Json | null,"retrieved_at"?: string,"scholarship_id"?: string,"snapshot_id"?: string,"status_code"?: number,"url"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "scholarship_evidence_scholarship_id_fkey"
      columns: ["scholarship_id"]
isOneToOne: false
      referencedRelation: "scholarships"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "scholarship_evidence_snapshot_id_scholarship_id_fkey"
      columns: ["snapshot_id","scholarship_id"]
isOneToOne: false
      referencedRelation: "scholarship_snapshots"
      referencedColumns: ["id","scholarship_id"]
    }
                  ]
                },"scholarship_funding": {
                  Row: {
                    "amount": number | null,"applicant_status": string | null,"benefit_type": string,"conditions": (string)[],"coverage": string,"created_at": string,"currency": string | null,"duration_text": string | null,"id": string,"original_text": string,"payment_period": string | null,"requires_human_review": boolean,"scholarship_id": string,"snapshot_id": string,"source_section": string,"source_url": string,"variant_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "amount"?: number | null,"applicant_status"?: string | null,"benefit_type": string,"conditions"?: (string)[],"coverage": string,"created_at"?: string,"currency"?: string | null,"duration_text"?: string | null,"id"?: string,"original_text": string,"payment_period"?: string | null,"requires_human_review"?: boolean,"scholarship_id": string,"snapshot_id": string,"source_section": string,"source_url": string,"variant_id"?: string | null
                  }
                  Update: {
                    "amount"?: number | null,"applicant_status"?: string | null,"benefit_type"?: string,"conditions"?: (string)[],"coverage"?: string,"created_at"?: string,"currency"?: string | null,"duration_text"?: string | null,"id"?: string,"original_text"?: string,"payment_period"?: string | null,"requires_human_review"?: boolean,"scholarship_id"?: string,"snapshot_id"?: string,"source_section"?: string,"source_url"?: string,"variant_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "scholarship_funding_scholarship_id_fkey"
      columns: ["scholarship_id"]
isOneToOne: false
      referencedRelation: "scholarships"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "scholarship_funding_snapshot_fk"
      columns: ["snapshot_id","scholarship_id"]
isOneToOne: false
      referencedRelation: "scholarship_snapshots"
      referencedColumns: ["id","scholarship_id"]
    },{
      foreignKeyName: "scholarship_funding_variant_fk"
      columns: ["variant_id","scholarship_id","snapshot_id"]
isOneToOne: false
      referencedRelation: "scholarship_variants"
      referencedColumns: ["id","scholarship_id","snapshot_id"]
    }
                  ]
                },"scholarship_language_requirements": {
                  Row: {
                    "accepted": boolean | null,"alternative_group": string | null,"applicant_status": string | null,"cefr_level": string | null,"certificate_max_age_months": number | null,"conditions": (string)[],"country_of_application": string | null,"created_at": string,"exceptions": (string)[],"id": string,"language": string,"minimum_score": number | null,"operator": string | null,"original_text": string,"requirement_stage": string | null,"requirement_strength": string,"requires_human_review": boolean,"scholarship_id": string,"score_scale": string | null,"snapshot_id": string,"source_section": string,"source_url": string,"test_name": string | null,"variant_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "accepted"?: boolean | null,"alternative_group"?: string | null,"applicant_status"?: string | null,"cefr_level"?: string | null,"certificate_max_age_months"?: number | null,"conditions"?: (string)[],"country_of_application"?: string | null,"created_at"?: string,"exceptions"?: (string)[],"id"?: string,"language": string,"minimum_score"?: number | null,"operator"?: string | null,"original_text": string,"requirement_stage"?: string | null,"requirement_strength": string,"requires_human_review"?: boolean,"scholarship_id": string,"score_scale"?: string | null,"snapshot_id": string,"source_section": string,"source_url": string,"test_name"?: string | null,"variant_id"?: string | null
                  }
                  Update: {
                    "accepted"?: boolean | null,"alternative_group"?: string | null,"applicant_status"?: string | null,"cefr_level"?: string | null,"certificate_max_age_months"?: number | null,"conditions"?: (string)[],"country_of_application"?: string | null,"created_at"?: string,"exceptions"?: (string)[],"id"?: string,"language"?: string,"minimum_score"?: number | null,"operator"?: string | null,"original_text"?: string,"requirement_stage"?: string | null,"requirement_strength"?: string,"requires_human_review"?: boolean,"scholarship_id"?: string,"score_scale"?: string | null,"snapshot_id"?: string,"source_section"?: string,"source_url"?: string,"test_name"?: string | null,"variant_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "scholarship_language_requirements_scholarship_id_fkey"
      columns: ["scholarship_id"]
isOneToOne: false
      referencedRelation: "scholarships"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "scholarship_language_requirements_snapshot_fk"
      columns: ["snapshot_id","scholarship_id"]
isOneToOne: false
      referencedRelation: "scholarship_snapshots"
      referencedColumns: ["id","scholarship_id"]
    },{
      foreignKeyName: "scholarship_language_requirements_variant_fk"
      columns: ["variant_id","scholarship_id","snapshot_id"]
isOneToOne: false
      referencedRelation: "scholarship_variants"
      referencedColumns: ["id","scholarship_id","snapshot_id"]
    }
                  ]
                },"scholarship_required_documents": {
                  Row: {
                    "applicant_status": string | null,"certification_requirements": string | null,"conditions": (string)[],"created_at": string,"document_type": string,"id": string,"instructions": string,"mandatory": boolean | null,"maximum_pages": number | null,"minimum_pages": number | null,"name": string,"number_of_references": number | null,"required_format": string | null,"requires_human_review": boolean,"scholarship_id": string,"snapshot_id": string,"source_section": string,"source_url": string,"submission_stage": string | null,"translation_requirements": string | null,"variant_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "applicant_status"?: string | null,"certification_requirements"?: string | null,"conditions"?: (string)[],"created_at"?: string,"document_type": string,"id"?: string,"instructions": string,"mandatory"?: boolean | null,"maximum_pages"?: number | null,"minimum_pages"?: number | null,"name": string,"number_of_references"?: number | null,"required_format"?: string | null,"requires_human_review"?: boolean,"scholarship_id": string,"snapshot_id": string,"source_section": string,"source_url": string,"submission_stage"?: string | null,"translation_requirements"?: string | null,"variant_id"?: string | null
                  }
                  Update: {
                    "applicant_status"?: string | null,"certification_requirements"?: string | null,"conditions"?: (string)[],"created_at"?: string,"document_type"?: string,"id"?: string,"instructions"?: string,"mandatory"?: boolean | null,"maximum_pages"?: number | null,"minimum_pages"?: number | null,"name"?: string,"number_of_references"?: number | null,"required_format"?: string | null,"requires_human_review"?: boolean,"scholarship_id"?: string,"snapshot_id"?: string,"source_section"?: string,"source_url"?: string,"submission_stage"?: string | null,"translation_requirements"?: string | null,"variant_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "scholarship_required_documents_scholarship_id_fkey"
      columns: ["scholarship_id"]
isOneToOne: false
      referencedRelation: "scholarships"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "scholarship_required_documents_snapshot_fk"
      columns: ["snapshot_id","scholarship_id"]
isOneToOne: false
      referencedRelation: "scholarship_snapshots"
      referencedColumns: ["id","scholarship_id"]
    },{
      foreignKeyName: "scholarship_required_documents_variant_fk"
      columns: ["variant_id","scholarship_id","snapshot_id"]
isOneToOne: false
      referencedRelation: "scholarship_variants"
      referencedColumns: ["id","scholarship_id","snapshot_id"]
    }
                  ]
                },"scholarship_requirements": {
                  Row: {
                    "academic_rank": string | null,"applicant_status": string | null,"category": string,"collections": (string)[],"conditions": (string)[],"country_of_application": string | null,"created_at": string,"evidence_excerpt": string,"exceptions": (string)[],"extraction_method": string,"gpa_scale": number | null,"id": string,"interpretation_confidence": number,"is_hard_requirement": boolean,"maximum_years_since_graduation": number | null,"minimum_experience_months": number | null,"minimum_gpa": number | null,"minimum_publications": number | null,"normalized_meaning": string,"operator": string | null,"original_text": string,"requirement_strength": string,"requires_human_review": boolean,"rule_type": string,"scholarship_id": string,"snapshot_id": string,"source_requirement_id": string,"source_section": string,"source_url": string,"unit": string | null,"value": Json | null,"variant_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "academic_rank"?: string | null,"applicant_status"?: string | null,"category": string,"collections"?: (string)[],"conditions"?: (string)[],"country_of_application"?: string | null,"created_at"?: string,"evidence_excerpt": string,"exceptions"?: (string)[],"extraction_method": string,"gpa_scale"?: number | null,"id"?: string,"interpretation_confidence": number,"is_hard_requirement"?: boolean,"maximum_years_since_graduation"?: number | null,"minimum_experience_months"?: number | null,"minimum_gpa"?: number | null,"minimum_publications"?: number | null,"normalized_meaning": string,"operator"?: string | null,"original_text": string,"requirement_strength": string,"requires_human_review"?: boolean,"rule_type": string,"scholarship_id": string,"snapshot_id": string,"source_requirement_id": string,"source_section": string,"source_url": string,"unit"?: string | null,"value"?: Json | null,"variant_id"?: string | null
                  }
                  Update: {
                    "academic_rank"?: string | null,"applicant_status"?: string | null,"category"?: string,"collections"?: (string)[],"conditions"?: (string)[],"country_of_application"?: string | null,"created_at"?: string,"evidence_excerpt"?: string,"exceptions"?: (string)[],"extraction_method"?: string,"gpa_scale"?: number | null,"id"?: string,"interpretation_confidence"?: number,"is_hard_requirement"?: boolean,"maximum_years_since_graduation"?: number | null,"minimum_experience_months"?: number | null,"minimum_gpa"?: number | null,"minimum_publications"?: number | null,"normalized_meaning"?: string,"operator"?: string | null,"original_text"?: string,"requirement_strength"?: string,"requires_human_review"?: boolean,"rule_type"?: string,"scholarship_id"?: string,"snapshot_id"?: string,"source_requirement_id"?: string,"source_section"?: string,"source_url"?: string,"unit"?: string | null,"value"?: Json | null,"variant_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "scholarship_requirements_scholarship_id_fkey"
      columns: ["scholarship_id"]
isOneToOne: false
      referencedRelation: "scholarships"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "scholarship_requirements_snapshot_fk"
      columns: ["snapshot_id","scholarship_id"]
isOneToOne: false
      referencedRelation: "scholarship_snapshots"
      referencedColumns: ["id","scholarship_id"]
    },{
      foreignKeyName: "scholarship_requirements_variant_fk"
      columns: ["variant_id","scholarship_id","snapshot_id"]
isOneToOne: false
      referencedRelation: "scholarship_variants"
      referencedColumns: ["id","scholarship_id","snapshot_id"]
    }
                  ]
                },"scholarship_snapshots": {
                  Row: {
                    "created_at": string,"extractor_version": string,"fetch_run_id": string,"id": string,"normalized_payload": NonNullable<Json>,"payload_sha256": string,"provider_record_id": string,"retrieved_at": string,"schema_version": string,"scholarship_id": string,"source_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"extractor_version": string,"fetch_run_id": string,"id"?: string,"normalized_payload": NonNullable<Json>,"payload_sha256": string,"provider_record_id": string,"retrieved_at": string,"schema_version": string,"scholarship_id": string,"source_id": string
                  }
                  Update: {
                    "created_at"?: string,"extractor_version"?: string,"fetch_run_id"?: string,"id"?: string,"normalized_payload"?: NonNullable<Json>,"payload_sha256"?: string,"provider_record_id"?: string,"retrieved_at"?: string,"schema_version"?: string,"scholarship_id"?: string,"source_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "scholarship_snapshots_fetch_run_id_source_id_fkey"
      columns: ["fetch_run_id","source_id"]
isOneToOne: false
      referencedRelation: "fetch_runs"
      referencedColumns: ["id","source_id"]
    },{
      foreignKeyName: "scholarship_snapshots_scholarship_id_fkey"
      columns: ["scholarship_id"]
isOneToOne: false
      referencedRelation: "scholarships"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "scholarship_snapshots_scholarship_id_source_id_fkey"
      columns: ["scholarship_id","source_id"]
isOneToOne: false
      referencedRelation: "scholarships"
      referencedColumns: ["id","source_id"]
    },{
      foreignKeyName: "scholarship_snapshots_source_id_fkey"
      columns: ["source_id"]
isOneToOne: false
      referencedRelation: "scholarship_sources"
      referencedColumns: ["id"]
    }
                  ]
                },"scholarship_sources": {
                  Row: {
                    "created_at": string,"enabled": boolean,"fetch_interval_hours": number,"id": string,"name": string,"source_type": string,"source_url": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"enabled"?: boolean,"fetch_interval_hours"?: number,"id"?: string,"name": string,"source_type": string,"source_url": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"enabled"?: boolean,"fetch_interval_hours"?: number,"id"?: string,"name"?: string,"source_type"?: string,"source_url"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"scholarship_variants": {
                  Row: {
                    "applicant_status": string,"application_procedure": string | null,"application_status": string,"application_status_evidence": string | null,"country_of_application": string | null,"country_options": NonNullable<Json>,"country_semantics": string,"created_at": string,"egypt_selectable": boolean | null,"egypt_support_status": string,"error_detail": string | null,"evidence_urls": (string)[],"extraction_quality": string,"id": string,"interaction_method": string,"procedure_loaded": boolean,"provider_country_value": string | null,"provider_status_value": string | null,"requires_human_review": boolean,"scholarship_id": string,"selection_confirmed": boolean,"snapshot_id": string,"status_options": NonNullable<Json>
                  }
                  ComputedFields: never
                  Insert: {
                    "applicant_status": string,"application_procedure"?: string | null,"application_status"?: string,"application_status_evidence"?: string | null,"country_of_application"?: string | null,"country_options"?: NonNullable<Json>,"country_semantics": string,"created_at"?: string,"egypt_selectable"?: boolean | null,"egypt_support_status": string,"error_detail"?: string | null,"evidence_urls"?: (string)[],"extraction_quality": string,"id"?: string,"interaction_method": string,"procedure_loaded"?: boolean,"provider_country_value"?: string | null,"provider_status_value"?: string | null,"requires_human_review"?: boolean,"scholarship_id": string,"selection_confirmed"?: boolean,"snapshot_id": string,"status_options"?: NonNullable<Json>
                  }
                  Update: {
                    "applicant_status"?: string,"application_procedure"?: string | null,"application_status"?: string,"application_status_evidence"?: string | null,"country_of_application"?: string | null,"country_options"?: NonNullable<Json>,"country_semantics"?: string,"created_at"?: string,"egypt_selectable"?: boolean | null,"egypt_support_status"?: string,"error_detail"?: string | null,"evidence_urls"?: (string)[],"extraction_quality"?: string,"id"?: string,"interaction_method"?: string,"procedure_loaded"?: boolean,"provider_country_value"?: string | null,"provider_status_value"?: string | null,"requires_human_review"?: boolean,"scholarship_id"?: string,"selection_confirmed"?: boolean,"snapshot_id"?: string,"status_options"?: NonNullable<Json>
                  }
                  Relationships: [
                    {
      foreignKeyName: "scholarship_variants_scholarship_id_fkey"
      columns: ["scholarship_id"]
isOneToOne: false
      referencedRelation: "scholarships"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "scholarship_variants_snapshot_id_scholarship_id_fkey"
      columns: ["snapshot_id","scholarship_id"]
isOneToOne: false
      referencedRelation: "scholarship_snapshots"
      referencedColumns: ["id","scholarship_id"]
    }
                  ]
                },"scholarships": {
                  Row: {
                    "application_portals": (string)[],"application_status": string | null,"application_status_evidence": string | null,"body_text": string,"category": string | null,"covered_costs": (string)[],"created_at": string,"data_label": string,"deadline_at": string | null,"deadline_certainty": string,"deadline_timezone": string | null,"description": string | null,"destination_countries": (string)[],"egypt_support_status": string,"eligibility_rules": NonNullable<Json>,"eligibility_summary": string,"eligible_academic_disciplines": (string)[],"extracted_at": string | null,"extraction_quality": string | null,"fields": (string)[],"funding_type": string,"id": string,"last_fetch_run_id": string | null,"last_verified_at": string | null,"latest_snapshot_id": string | null,"missing_data_notes": (string)[],"official_application_url": string,"official_source_url": string,"open_status": string,"program_objectives": (string)[],"provider": string,"published": boolean,"required_documents": NonNullable<Json>,"retrieval_date": string | null,"search_vector": unknown,"slug": string,"source_checked_at": string | null,"source_id": string | null,"source_record_id": string | null,"source_url": string,"supported_degrees": (string)[],"title": string,"updated_at": string,"verification_state": string
                  }
                  ComputedFields: never
                  Insert: {
                    "application_portals"?: (string)[],"application_status"?: string | null,"application_status_evidence"?: string | null,"body_text"?: string,"category"?: string | null,"covered_costs"?: (string)[],"created_at"?: string,"data_label"?: string,"deadline_at"?: string | null,"deadline_certainty"?: string,"deadline_timezone"?: string | null,"description"?: string | null,"destination_countries"?: (string)[],"egypt_support_status"?: string,"eligibility_rules"?: NonNullable<Json>,"eligibility_summary": string,"eligible_academic_disciplines"?: (string)[],"extracted_at"?: string | null,"extraction_quality"?: string | null,"fields"?: (string)[],"funding_type": string,"id"?: string,"last_fetch_run_id"?: string | null,"last_verified_at"?: string | null,"latest_snapshot_id"?: string | null,"missing_data_notes"?: (string)[],"official_application_url": string,"official_source_url": string,"open_status"?: string,"program_objectives"?: (string)[],"provider": string,"published"?: boolean,"required_documents"?: NonNullable<Json>,"retrieval_date"?: string | null,"search_vector"?: never,"slug": string,"source_checked_at"?: string | null,"source_id"?: string | null,"source_record_id"?: string | null,"source_url": string,"supported_degrees"?: (string)[],"title": string,"updated_at"?: string,"verification_state"?: string
                  }
                  Update: {
                    "application_portals"?: (string)[],"application_status"?: string | null,"application_status_evidence"?: string | null,"body_text"?: string,"category"?: string | null,"covered_costs"?: (string)[],"created_at"?: string,"data_label"?: string,"deadline_at"?: string | null,"deadline_certainty"?: string,"deadline_timezone"?: string | null,"description"?: string | null,"destination_countries"?: (string)[],"egypt_support_status"?: string,"eligibility_rules"?: NonNullable<Json>,"eligibility_summary"?: string,"eligible_academic_disciplines"?: (string)[],"extracted_at"?: string | null,"extraction_quality"?: string | null,"fields"?: (string)[],"funding_type"?: string,"id"?: string,"last_fetch_run_id"?: string | null,"last_verified_at"?: string | null,"latest_snapshot_id"?: string | null,"missing_data_notes"?: (string)[],"official_application_url"?: string,"official_source_url"?: string,"open_status"?: string,"program_objectives"?: (string)[],"provider"?: string,"published"?: boolean,"required_documents"?: NonNullable<Json>,"retrieval_date"?: string | null,"search_vector"?: never,"slug"?: string,"source_checked_at"?: string | null,"source_id"?: string | null,"source_record_id"?: string | null,"source_url"?: string,"supported_degrees"?: (string)[],"title"?: string,"updated_at"?: string,"verification_state"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "scholarships_fetch_source_fk"
      columns: ["last_fetch_run_id","source_id"]
isOneToOne: false
      referencedRelation: "fetch_runs"
      referencedColumns: ["id","source_id"]
    },{
      foreignKeyName: "scholarships_latest_snapshot_fk"
      columns: ["latest_snapshot_id","id"]
isOneToOne: false
      referencedRelation: "scholarship_snapshots"
      referencedColumns: ["id","scholarship_id"]
    },{
      foreignKeyName: "scholarships_source_id_fkey"
      columns: ["source_id"]
isOneToOne: false
      referencedRelation: "scholarship_sources"
      referencedColumns: ["id"]
    }
                  ]
                },"sop_reviews": {
                  Row: {
                    "created_at": string,"feedback": NonNullable<Json>,"id": string,"input_excerpt": string | null,"provider": string,"scholarship_id": string,"source": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"feedback": NonNullable<Json>,"id"?: string,"input_excerpt"?: string | null,"provider": string,"scholarship_id": string,"source": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"feedback"?: NonNullable<Json>,"id"?: string,"input_excerpt"?: string | null,"provider"?: string,"scholarship_id"?: string,"source"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "sop_reviews_scholarship_id_fkey"
      columns: ["scholarship_id"]
isOneToOne: false
      referencedRelation: "scholarships"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sop_reviews_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"user_roles": {
                  Row: {
                    "created_at": string,"role": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"role": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"role"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            [_ in never]: never
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            
          }
        }
} as const
