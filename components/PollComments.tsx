import { Comment } from '@prisma/client';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
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

    // add a comment
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
        <div>
            <p>Ajouter un commentaire</p>
            <form onSubmit={onCommentSubmit} className="w-72 flex flex-col gap-2">
                <Input placeholder="Auteur" {...register('author', { required: true })} />
                <Textarea placeholder="Message" {...register('text', { required: true })} />
                <Button>Envoyer</Button>
            </form>
            <div className="flex flex-col gap-2">
                <p>Liste des commentaires</p>
                {comments.map((comment) => (
                    <div key={comment.id} className="border">
                        <p>{comment.author}</p>
                        <p>{comment.text}</p>
                    </div>
                ))}
            </div>
        </div>
    );
}
