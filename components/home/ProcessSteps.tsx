import { motion } from "framer-motion";
import { useTheme } from "next-themes";
import Image from "next/image";
import { Fragment } from "react";
import { useIsClient } from "usehooks-ts";

import { Card } from "../ui/card";

export const ProcessSteps = () => {
  const { theme } = useTheme();
  const isClient = useIsClient();

  const steps = [
    {
      icon:
        theme === "light"
          ? "/svg/home/create-poll-light.svg"
          : "/svg/home/create-poll.svg",
      text: "Vous créez votre sondage",
      width: "w-7/12",
    },
    {
      icon:
        theme === "light" ? "/svg/home/share-light.svg" : "/svg/home/share.svg",
      text: "Vous partagez le lien",
    },
    {
      icon:
        theme === "light"
          ? "/svg/home/user-choices-light.svg"
          : "/svg/home/user-choices.svg",
      text: "Vos amis s'inscrivent",
    },
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
            <motion.div
              variants={{
                init: { opacity: 0, scale: 0.8 },
                anim: { opacity: 1, scale: 1 },
              }}
            >
              <Card
                key={index}
                className="flex aspect-square max-w-[150px] flex-col items-center justify-between dark:bg-[#ffffff05] p-5 pt-0 text-center md:max-w-[220px] md:flex-1 lg:max-w-[250px] bg-gray-100/20"
              >
                {isClient && (
                  <Image
                    className={`m-auto ${step.width ?? "w-9/12"}`}
                    width={300}
                    height={300}
                    src={step.icon}
                    alt={step.text}
                  />
                )}
                <p className="text-xs md:text-base">{step.text}</p>
              </Card>
            </motion.div>
            {index !== steps.length - 1 && (
              <Image
                className="hidden w-6 sm:block lg:w-8"
                width={200}
                height={200}
                src="/svg/arrow.svg"
                alt="Puis"
              />
            )}
            {index === steps.length - 1 && (
              <Image
                className="w-6 lg:w-8"
                width={200}
                height={200}
                src={
                  theme === "light"
                    ? "/svg/sparkles-light.svg"
                    : "/svg/sparkles.svg"
                }
                alt="Fini"
              />
            )}
          </Fragment>
        );
      })}
    </motion.div>
  );
};
