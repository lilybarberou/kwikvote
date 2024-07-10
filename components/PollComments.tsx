import { useComment } from "@/hooks/use-comment";
import { useCommentsStore } from "@/lib/commentsStore";
import { useNotificationsStore } from "@/lib/notificationsStore";
import { Comment } from "@prisma/client";
import { format } from "date-fns";
import { fr } from "date-fns/locale/fr";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";

import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { useToast } from "./ui/use-toast";

type Props = {
  comments: Comment[];
  pollId: string;
};

type CommentForm = {
  author: string;
  text: string;
};

export default function PollComments(props: Props) {
  const { toast } = useToast();
  const { pollId } = props;
  const { subscription } = useNotificationsStore();
  const { comments, addComment } = useCommentsStore();
  const { register, handleSubmit, reset } = useForm<CommentForm>();
  const { createCommentMutation } = useComment();

  // ADD A COMMENT
  const onCommentSubmit = handleSubmit(async (data) => {
    createCommentMutation.mutate(
      {
        comment: { ...data, pollId },
        exceptEndpoint: subscription?.endpoint,
      },
      {
        onSuccess: (comment) => {
          addComment(comment!);
          reset();
        },
      },
    );
  });

  return (
    <div className="mt-6 flex flex-col gap-2">
      {comments.map((comment, index) => (
        <div
          key={comment.id}
          className={index < comments.length - 1 ? "border-b pb-3" : ""}
        >
          <p>
            {comment.author}{" "}
            <span className="ml-1 text-xs text-muted-foreground">
              {format(new Date(comment.createdAt), "EEEE PPp", { locale: fr })}
            </span>
          </p>
          <p className="mt-0.5 whitespace-pre-wrap text-sm">{comment.text}</p>
        </div>
      ))}
      <form
        onSubmit={onCommentSubmit}
        className="mt-5 flex max-w-[350px] flex-col gap-2 rounded bg-muted p-2"
      >
        <Input
          className="w-[230px]"
          placeholder="Auteur"
          {...register("author", { required: true })}
        />
        <Textarea
          placeholder="Message"
          {...register("text", { required: true })}
        />
        <Button disabled={createCommentMutation.isPending}>
          Envoyer
          {createCommentMutation.isPending && (
            <Loader2 className="ml-2 h-5 w-5 animate-spin" />
          )}
        </Button>
      </form>
    </div>
  );
}
