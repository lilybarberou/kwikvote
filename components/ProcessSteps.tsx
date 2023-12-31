import Image from 'next/image';
import { Card } from './ui/card';
import { Fragment } from 'react';
import { motion } from 'framer-motion';

export default function ProcessSteps() {
    const steps = [
        { icon: '/createPoll.svg', text: 'Vous créez votre sondage', width: 'w-7/12' },
        { icon: '/share.svg', text: 'Vous partagez le lien' },
        { icon: '/userChoices.svg', text: "Vos amis s'inscrivent" },
    ];

    return (
        <motion.div
            className="mb-32 flex flex-wrap items-center justify-center gap-3 lg:gap-7"
            variants={{ init: { opacity: 0 }, anim: { opacity: 1 } }}
            transition={{ staggerChildren: 0.3 }}
            initial="init"
            whileInView="anim"
        >
            {steps.map((step, index) => {
                return (
                    <Fragment key={index}>
                        <motion.div variants={{ init: { opacity: 0, scale: 0.8 }, anim: { opacity: 1, scale: 1 } }}>
                            <Card
                                key={index}
                                className="p-5 pt-0 max-w-[150px] flex flex-col items-center justify-between bg-[#ffffff05] aspect-square text-center md:flex-1 md:max-w-[220px] lg:max-w-[250px]"
                            >
                                <Image className={`m-auto ${step.width ?? 'w-9/12'}`} width={300} height={300} src={step.icon} alt={step.text} />
                                <p className="text-xs md:text-base">{step.text}</p>
                            </Card>
                        </motion.div>
                        {index !== steps.length - 1 && <Image className="hidden w-6 sm:block lg:w-8" width={200} height={200} src="/arrow.svg" alt="Puis" />}
                        {index === steps.length - 1 && <Image className="w-6 lg:w-8" width={200} height={200} src="/sparkles.svg" alt="Fini" />}
                    </Fragment>
                );
            })}
        </motion.div>
    );
}
