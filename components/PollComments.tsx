import { useState } from 'react';
import { format } from 'date-fns';
import fr from 'date-fns/locale/fr';
import { useForm } from 'react-hook-form';
import { Comment } from '@prisma/client';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Button } from './ui/button';
import { useNotificationsStore } from '@/lib/notificationsStore';
import { Loader2 } from 'lucide-react';
import { useToast } from './ui/use-toast';

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
    const [comments, setComments] = useState<Comment[]>(props.comments);
    const [submitLoading, setSubmitLoading] = useState(false);
    const { register, handleSubmit, reset } = useForm<CommentForm>();

    // ADD A COMMENT
    const onCommentSubmit = handleSubmit(async (data) => {
        setSubmitLoading(true);
        const res = await fetch('/api/comment', {
            method: 'POST',
            body: JSON.stringify({ comment: { ...data, pollId }, exceptEndpoint: subscription?.endpoint }),
        });
        setSubmitLoading(false);

        const comment = await res.json();

        if (res.status !== 200) {
            toast({
                title: 'Erreur lors de la création du commentaire',
                description: 'Veuillez réessayer plus tard',
                variant: 'destructive',
            });
        } else {
            setComments([...comments, comment]);
            reset();
        }
    });

    return (
        <div className="mt-6 flex flex-col gap-2">
            {comments.map((comment, index) => (
                <div key={comment.id} className={index < comments.length - 1 ? 'pb-3 border-b' : ''}>
                    <p>
                        {comment.author}{' '}
                        <span className="ml-1 text-xs text-muted-foreground">{format(new Date(comment.createdAt), 'PPp', { locale: fr })}</span>
                    </p>
                    <p>{comment.text}</p>
                </div>
            ))}
            <form onSubmit={onCommentSubmit} className="mt-5 p-2 max-w-[350px] flex flex-col gap-2 rounded bg-muted">
                <Input className="w-[230px]" placeholder="Auteur" {...register('author', { required: true })} />
                <Textarea placeholder="Message" {...register('text', { required: true })} />
                <Button disabled={submitLoading}>
                    Envoyer
                    {submitLoading && <Loader2 className="ml-2 w-5 h-5 animate-spin" />}
                </Button>
            </form>
        </div>
    );
}
