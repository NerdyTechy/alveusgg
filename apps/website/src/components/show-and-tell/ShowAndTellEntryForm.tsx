import React, { useMemo, useState } from "react";
import { useRouter } from "next/router";

import { Fieldset } from "../shared/form/Fieldset";
import { TextField } from "../shared/form/TextField";
import { RichTextField } from "../shared/form/RichTextField";
import {
  UploadAttachmentsField,
  useUploadAttachmentsData,
} from "../shared/form/UploadAttachmentsField";
import { Button } from "../shared/Button";
import { useFileUpload } from "../shared/hooks/useFileUpload";
import { ImageUploadAttachment } from "../shared/form/ImageUploadAttachment";
import { MessageBox } from "../shared/MessageBox";
import { TextAreaField } from "../shared/form/TextAreaField";
import {
  useVideoLinksData,
  VideoLinksField,
} from "../shared/form/VideoLinksField";
import type { ShowAndTellSubmitInput } from "@/server/db/show-and-tell";
import { trpc } from "@/utils/trpc";
import { notEmpty } from "@/utils/helpers";
import type { ShowAndTellEntryWithAttachments } from "@/components/show-and-tell/ShowAndTellEntry";
import IconLoading from "@/icons/IconLoading";

export const allowedFileTypes = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
] as const;
type AllowedFileTypes = typeof allowedFileTypes;

type ShowAndTellEntryFormProps = {
  isAnonymous?: boolean;
  entry?: ShowAndTellEntryWithAttachments;
  action: "review" | "create" | "update";
  onUpdate?: () => void;
};

export function ShowAndTellEntryForm({
  isAnonymous = false,
  action = "create",
  entry,
  onUpdate,
}: ShowAndTellEntryFormProps) {
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const create = trpc.showAndTell.create.useMutation();
  const update = trpc.showAndTell.update.useMutation();
  const review = trpc.adminShowAndTell.review.useMutation();
  const isLoading = create.isLoading || update.isLoading || review.isLoading;

  const imageAttachmentsData = useUploadAttachmentsData(
    useMemo(
      () =>
        entry?.attachments
          .filter((attachment) => attachment.attachmentType === "image")
          .map(({ imageAttachment }) => imageAttachment)
          .filter(notEmpty)
          .map((imageAttachment) => ({
            status: "saved",
            id: imageAttachment.id,
            url: imageAttachment.url,
            fileStorageObjectId: imageAttachment.fileStorageObjectId,
          })),
      [entry?.attachments]
    )
  );
  const videoLinksData = useVideoLinksData(
    useMemo(
      () =>
        entry?.attachments
          .filter((attachment) => attachment.attachmentType === "video")
          .map(({ linkAttachment }) => linkAttachment)
          .filter(notEmpty)
          .map(({ url }) => url),
      [entry?.attachments]
    )
  );

  const createFileUpload = trpc.showAndTell.createFileUpload.useMutation();
  const upload = useFileUpload<AllowedFileTypes>(
    (signature) => createFileUpload.mutateAsync(signature),
    { allowedFileTypes }
  );

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data: ShowAndTellSubmitInput = {
      displayName: formData.get("displayName") as string,
      title: formData.get("title") as string,
      text: formData.get("text") as string,
      imageAttachments: { create: [], update: {} },
      videoLinks: videoLinksData.videoUrls,
    };

    for (const fileReference of imageAttachmentsData.files) {
      if (
        fileReference.status !== "upload.done" &&
        fileReference.status !== "saved"
      ) {
        setError("Please wait for all uploads to finish");
        return;
      }

      const imageId = fileReference.id;
      const linkAttachmentData = {
        url: fileReference.url,
        fileStorageObjectId: fileReference.fileStorageObjectId,
        title: "", // Currently not supported
        description: "", // Currently not supported
        caption: String(formData.get(`image[${imageId}][caption]`) || ""),
        alternativeText: String(
          formData.get(`image[${imageId}][alternativeText]`) || ""
        ),
      };

      if (fileReference.status === "saved") {
        data.imageAttachments.update[imageId] = linkAttachmentData;
      } else {
        data.imageAttachments.create.push({
          ...linkAttachmentData,
          name: fileReference.file.name,
        });
      }
    }

    if (action === "create") {
      create.mutate(data, {
        onSuccess: () => {
          if (isAnonymous) {
            // We can't redirect to the entry because the user is anonymous
            setIsSubmitted(true);
            onUpdate?.();
          } else {
            // Redirect to my posts
            router.push(`/show-and-tell/my-posts/`);
          }
        },
        onError: (err) => {
          setError(err.message);
          onUpdate?.();
        },
      });
    } else if (action === "update" && entry) {
      update.mutate(
        { ...data, id: entry.id },
        {
          onSuccess: () => {
            setSuccessMessage("Entry updated successfully!");
            onUpdate?.();
          },
          onError: (err) => {
            setError(err.message);
            onUpdate?.();
          },
        }
      );
    } else if (action === "review" && entry) {
      review.mutate(
        { ...data, id: entry.id },
        {
          onSuccess: () => {
            setSuccessMessage("Entry updated successfully!");
            onUpdate?.();
          },
          onError: (err) => {
            setError(err.message);
            onUpdate?.();
          },
        }
      );
    }

    setError(null);
  };

  if (isSubmitted) {
    return (
      <div className="my-5">
        <MessageBox variant="success">
          Your entry has been submitted. It will be reviewed by a moderator and
          then published.
        </MessageBox>
      </div>
    );
  }

  return (
    <form className="my-5 flex flex-col gap-5" onSubmit={handleSubmit}>
      {error && <MessageBox variant="failure">{error}</MessageBox>}
      {successMessage && (
        <MessageBox variant="success">{successMessage}</MessageBox>
      )}

      <div className="flex flex-col gap-5 lg:flex-row lg:gap-20">
        <div className="flex flex-[3] flex-col gap-5">
          <Fieldset legend="About you">
            <TextField
              label="Name"
              isRequired
              name="displayName"
              autoComplete="name"
              minLength={1}
              maxLength={100}
              defaultValue={entry?.displayName || undefined}
              placeholder="What should we call you?"
            />
          </Fieldset>
          <Fieldset legend="Post">
            <TextField
              label="Title"
              isRequired
              minLength={1}
              maxLength={100}
              name="title"
              defaultValue={entry?.title}
              placeholder="What's your post about?"
            />
            <RichTextField
              label="Content"
              name="text"
              defaultValue={entry?.text}
              maxLength={700}
            />
          </Fieldset>
        </div>
        <div className="flex flex-[2] flex-col gap-5">
          <Fieldset legend="Attachments">
            <div className="lg:mb-10">
              <VideoLinksField name="videoUrls" {...videoLinksData} />
            </div>
            <UploadAttachmentsField
              {...imageAttachmentsData}
              label="Pictures"
              upload={upload}
              allowedFileTypes={allowedFileTypes}
              renderAttachment={({ fileReference, ...props }) => {
                const initialData =
                  fileReference.status === "saved"
                    ? entry?.attachments.find(
                        ({ imageAttachment }) =>
                          imageAttachment &&
                          imageAttachment.id === fileReference.id
                      )?.imageAttachment
                    : undefined;

                return (
                  <ImageUploadAttachment
                    {...props}
                    fileReference={fileReference}
                  >
                    <div>
                      <TextAreaField
                        name={`image[${fileReference.id}][caption]`}
                        label="Caption"
                        inputClassName="h-10"
                        defaultValue={initialData?.caption}
                      />
                      <TextAreaField
                        name={`image[${fileReference.id}][alternativeText]`}
                        label="Alternative Text"
                        defaultValue={initialData?.alternativeText}
                      />
                    </div>
                  </ImageUploadAttachment>
                );
              }}
            />
          </Fieldset>
        </div>
      </div>
      <div className="flex flex-col gap-4">
        {error && <MessageBox variant="failure">{error}</MessageBox>}
        {successMessage && (
          <MessageBox variant="success">{successMessage}</MessageBox>
        )}

        <Button type="submit">
          {isLoading ? (
            <>
              <IconLoading className="h-5 w-5" />
              Saving …
            </>
          ) : action === "create" ? (
            "Submit for review"
          ) : (
            "Save changes"
          )}
        </Button>
      </div>
    </form>
  );
}
