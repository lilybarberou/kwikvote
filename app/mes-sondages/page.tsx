import { MyPolls } from '@/components/MyPolls';
import { Suspense } from 'react';

export default function SearchPollsByEmail() {
  return (
    <div className="flex flex-col">
      <h1 className="mb-4 text-3xl font-bold">Mes sondages</h1>
      <p className="mb-6 text-muted-foreground">Si vous avez lié vos sondages à votre adresse mail, vous pourrez retrouver la liste de vos sondages.</p>
      <Suspense>
        <MyPolls />
      </Suspense>
    </div>
  );
}
