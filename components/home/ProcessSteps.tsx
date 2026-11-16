import { ThemedImage } from "@/components/ThemedImage";
import { m } from "framer-motion";
import Image from "next/image";
import { Fragment } from "react";

import { Card } from "../ui/card";

export const ProcessSteps = () => {
  const steps = [
    {
      icon: "create-poll",
      text: "Vous créez votre sondage",
      width: "w-7/12",
    },
    {
      icon: "share",
      text: "Vous partagez le lien",
    },
    {
      icon: "user-choices",
      text: "Vos amis s'inscrivent",
    },
  ];

  return (
    <m.div
      className="mb-32 flex flex-wrap items-center justify-center gap-3 lg:gap-7"
      variants={{ init: { opacity: 0 }, anim: { opacity: 1 } }}
      transition={{ staggerChildren: 0.3 }}
      initial="init"
      whileInView="anim"
    >
      {steps.map((step, index) => {
        return (
          <Fragment key={index}>
            <m.div
              variants={{
                init: { opacity: 0, scale: 0.8 },
                anim: { opacity: 1, scale: 1 },
              }}
            >
              <Card
                key={index}
                className="flex aspect-square max-w-[150px] flex-col items-center justify-between bg-gray-100/20 p-5 pt-0 text-center dark:bg-[#ffffff05] md:max-w-[220px] md:flex-1 lg:max-w-[250px]"
              >
                <ThemedImage
                  className={`m-auto ${step.width ?? "w-9/12"}`}
                  width={300}
                  height={300}
                  lightSrc={`/svg/home/${step.icon}-light.svg`}
                  darkSrc={`/svg/home/${step.icon}.svg`}
                  // decorative: the text under it says the step
                  alt=""
                />
                <p className="text-xs md:text-base">{step.text}</p>
              </Card>
            </m.div>
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
              <ThemedImage
                className="w-6 lg:w-8"
                width={200}
                height={200}
                lightSrc="/svg/sparkles-light.svg"
                darkSrc="/svg/sparkles.svg"
                alt="Fini"
              />
            )}
          </Fragment>
        );
      })}
    </m.div>
  );
};
