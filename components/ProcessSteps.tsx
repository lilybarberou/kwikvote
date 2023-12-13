import Image from 'next/image';
import { Card } from './ui/card';
import { Fragment } from 'react';

export default function ProcessSteps() {
    const steps = [
        { icon: '/createPoll.svg', text: 'Vous créez votre sondage', width: 'w-7/12' },
        { icon: '/share.svg', text: 'Vous partagez votre lien' },
        { icon: '/userChoices.svg', text: "Vos amis s'inscrivent" },
    ];

    return (
        <div className="mb-32 flex flex-col flex-wrap gap-5 md:flex-row lg:gap-7">
            {steps.map((step, index) => {
                return (
                    <Fragment key={index}>
                        <Card
                            key={index}
                            className="p-5 pt-0 max-w-[230px] flex flex-col items-center justify-between bg-[#ffffff05] aspect-square text-center sm:w-auto sm:flex-1 md:max-w-[240px] lg:max-w-[270px]"
                        >
                            <Image className={`m-auto ${step.width ?? 'w-9/12'}`} width={300} height={300} src={step.icon} alt={step.text} />
                            <p>{step.text}</p>
                        </Card>
                        {index !== steps.length - 1 && (
                            <Image className="rotate-90 m-auto w-7 lg:w-8 md:rotate-0" width={200} height={200} src="/arrow.svg" alt="Puis" />
                        )}
                        {index === steps.length - 1 && <Image className="m-auto w-7 lg:w-8" width={200} height={200} src="/sparkles.svg" alt="Fini" />}
                    </Fragment>
                );
            })}
        </div>
    );
}
