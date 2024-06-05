import { SetStateAction, useEffect, useState } from 'react';
import { v4 } from 'uuid';
import { Controller, useForm } from 'react-hook-form';
import { useVotesStore } from '@/lib/votesStore';
import { getDate, timeTwoDigit } from '@/lib/utils';
import { Loader2, Trash2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { DialogClose, DialogContent, DialogFooter, DialogTitle } from './ui/dialog';
import { useToast } from './ui/use-toast';
import { Button } from './ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useNotificationsStore } from '@/lib/notificationsStore';
import { PollSlot } from '@/app/api/poll/id/[value]/route';

type Props = {
  slots: { id: string; startDate: Date; endDate: Date }[];
  pollId: string;
  pollType: number;
  currentVoteId: string;
  closeDialog: () => void;
  setCurrentVoteId: React.Dispatch<SetStateAction<string>>;
  setSlots?: React.Dispatch<SetStateAction<PollSlot[]>>;
};

export default function DialogVote(props: Props) {
  const [loading, setLoading] = useState(false);
  const { currentVoteId, slots, closeDialog, pollId, setCurrentVoteId, pollType, setSlots } = props;
  const { removeVote: deleteVote, addVote, votes } = useVotesStore();
  const { subscription } = useNotificationsStore();
  const { toast } = useToast();
  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<{ name: string; [key: string]: string }>();

  useEffect(() => {
    reset();
  }, [currentVoteId, reset]);

  const submitVote = handleSubmit(async (data) => {
    // check if choices have been modified
    if (currentVoteId && votes[currentVoteId]?.choices.every((choice) => choice.choice === parseInt(data[`choice-${choice.slotId}`]))) {
      // check if name has been modified
      if (votes[currentVoteId]?.name === data.name) {
        // do not submit  if nothing has changed
        closeDialog();
        return;
      } else {
        // submit name only
        setLoading(true);
        const res = await fetch('/api/vote/name', {
          method: 'PUT',
          body: JSON.stringify({
            voteId: currentVoteId,
            name: data.name,
          }),
        });
        setLoading(false);

        if (res.ok) {
          addVote({ ...votes[currentVoteId], name: data.name });
          closeDialog();
          reset();
          setCurrentVoteId('edited'); // TODO FAIRE MIEUX
          return;
        } else {
          toast({
            title: 'Erreur lors de la modification du vote',
            description: 'Veuillez réessayer plus tard',
            variant: 'destructive',
          });
        }
      }
    }

    const formattedData = {
      id: currentVoteId || v4(),
      name: data.name,
      choices: slots.map((slot) => {
        const choiceId = votes[currentVoteId]?.choices.find((choice) => choice.slotId === slot.id)?.id;
        return { id: choiceId || v4(), slotId: slot.id, choice: parseInt(data[`choice-${slot.id}`]) };
      }),
      subscription: subscription || undefined,
    };

    setLoading(true);
    const res = await fetch('/api/vote', {
      method: 'POST',
      body: JSON.stringify({
        pollId,
        pollType,
        ...formattedData,
      }),
    });
    setLoading(false);

    if (res.ok) {
      if (pollType == 2 && setSlots) {
        const resData = await res.json();
        setSlots((prevSlots) => prevSlots.map((slot) => ({ ...slot, ...(resData.slots[slot.id] || {}) })));
      }
      addVote({ ...formattedData, subscriptions: subscription ? [subscription] : [] });
      closeDialog();
      reset();
      setCurrentVoteId('edited'); // TODO FAIRE MIEUX
    } else {
      toast({
        title: 'Erreur lors de la création du vote',
        description: 'Veuillez réessayer plus tard',
        variant: 'destructive',
      });
    }
  });

  const removeVote = async () => {
    const res = await fetch(`/api/vote/${currentVoteId}`, {
      method: 'DELETE',
      body: JSON.stringify({ pollId, pollType }),
    });

    if (res.ok) {
      if (pollType == 1) deleteVote(currentVoteId);
      else if (pollType == 2 && setSlots) {
        const resData = await res.json();
        if (resData.slots) {
          setSlots((prevSlots) => prevSlots.map((slot) => ({ ...slot, ...(resData.slots[slot.id] || {}) })));
        }
      }

      closeDialog();
    } else {
      toast({
        title: 'Erreur lors de la suppression du vote',
        description: 'Veuillez réessayer plus tard',
        variant: 'destructive',
      });
    }
  };

  const DialogTitleBySlotType = () => {
    let text = '';
    if (pollType == 1) {
      text = currentVoteId ? 'Modifier un vote' : 'Ajouter un vote';
    } else if (pollType == 2) {
      text = currentVoteId ? 'Modifier une inscription' : 'Ajouter une inscription';
    }

    return <DialogTitle>{text}</DialogTitle>;
  };

  return (
    <DialogContent onOpenAutoFocus={(e) => e.preventDefault()} className="w-11/12 max-w-[400px]">
      <DialogTitleBySlotType />
      <form onSubmit={submitVote}>
        <Label className="mt-4" htmlFor="name">
          Nom
        </Label>
        <Input
          autoFocus={!Boolean(currentVoteId)}
          className="mt-2 mb-4"
          id="name"
          defaultValue={votes[currentVoteId]?.name ?? ''}
          placeholder="John Doe"
          {...register('name', { required: true })}
        />
        <div>
          {slots.map((slot, index) => (
            <div
              key={slot.id}
              className={`py-4 flex flex-wrap gap-x-14 gap-y-3 items-center sm:py-2 sm:grid sm:grid-cols-[max-content_auto] ${
                slots.length - 1 === index ? '' : 'border-b-2'
              }`}
            >
              <div className="flex flex-wrap items-end gap-x-2 sm:flex-col sm:items-start">
                <p>{getDate(slot.startDate)}</p>
                <p className="text-sm text-muted-foreground">{timeTwoDigit(slot.startDate)}</p>
              </div>
              <div className="flex-1">
                <Controller
                  control={control}
                  rules={{ required: true }}
                  name={`choice-${slot.id}`}
                  defaultValue={votes[currentVoteId]?.choices.find((choice) => choice.slotId === slot.id)?.choice.toString() ?? ''}
                  render={({ field }) => (
                    <Select {...field} onValueChange={field.onChange}>
                      <SelectTrigger autoFocus={currentVoteId ? index == 0 : false} className="min-w-[180px]">
                        <SelectValue placeholder="À définir" />
                      </SelectTrigger>
                      <SelectContent
                        ref={(ref) => {
                          if (!ref) return;
                          ref.ontouchstart = (e) => e.preventDefault();
                        }}
                      >
                        <SelectItem value="1">Oui</SelectItem>
                        <SelectItem value="2">Non</SelectItem>
                        {pollType == 1 && <SelectItem value="3">Ne sais pas</SelectItem>}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors[`choice-${slot.id}`] && <p className="ml-auto text-sm text-destructive">Champ requis</p>}
              </div>
            </div>
          ))}
        </div>
        <DialogFooter className="mt-4 flex-row">
          {currentVoteId && (
            <TooltipProvider>
              <Tooltip delayDuration={300}>
                <TooltipTrigger asChild>
                  <Button className="mr-auto" onClick={removeVote} type="button" size="icon" variant="destructive">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Supprimer le vote</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          <div className="flex gap-2">
            <DialogClose asChild>
              <Button variant="outline">Annuler</Button>
            </DialogClose>
            <Button type="submit" disabled={loading}>
              Confirmer
              {loading && <Loader2 className="ml-2 w-5 h-5 animate-spin" />}
            </Button>
          </div>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
