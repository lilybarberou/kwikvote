import { useState } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useForm } from 'react-hook-form';
import { Comment } from '@prisma/client';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Button } from './ui/button';

type Props = {
    comments: Comment[];
    pollId: string;
};

type CommentForm = {
    author: string;
    text: string;
};

export default function PollComments(props: Props) {
    const { pollId } = props;
    const [comments, setComments] = useState<Comment[]>(props.comments);
    const { register, handleSubmit, reset } = useForm<CommentForm>();

    // ADD A COMMENT
    const onCommentSubmit = handleSubmit(async (data) => {
        const res = await fetch('/api/comment', {
            method: 'POST',
            body: JSON.stringify({ ...data, pollId }),
        });
        const comment = await res.json();

        if (res.status !== 200) return alert(comment.message);
        setComments([...comments, comment]);
        reset();
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
                <Button>Envoyer</Button>
            </form>
        </div>
    );
}
