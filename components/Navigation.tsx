'use client';

import Link from 'next/link';
import { Button } from './ui/button';
import { usePathname } from 'next/navigation';
import { History, Menu, PlusCircle } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from './ui/popover';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from './ui/tooltip';
import ConsultedHistory from '../components/ConsultedHistory';
import { useState } from 'react';
import { Card } from './ui/card';

export default function Navigation() {
    const [mobileNavOpen, setMobileNavOpen] = useState(false);
    const pathname = usePathname();

    const ActiveLink = (props: { href: string; label: string; mobileItem?: boolean }) => {
        const closeMenu = () => {
            if (props.mobileItem) {
                setMobileNavOpen(false);
            }
        };

        return (
            <Link
                onClick={closeMenu}
                className={`${props.mobileItem ? 'p-2' : 'hidden'} sm:block ${pathname === props.href ? 'font-semibold' : ''}`}
                href={props.href}
            >
                {props.label}
            </Link>
        );
    };

    return (
        <nav className="sticky top-0 py-2 mb-12 w-full backdrop-blur-sm bg-[#00000026] border-b-[0.5px] border-b-[#ffffff21] sm:mb-20">
            <div className="m-auto px-4 max-w-6xl flex justify-between items-center">
                <div className="flex items-center gap-6">
                    <Link href="/">
                        <div className="mr-4 flex gap-3 items-center text-xl font-semibold">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="22.66" viewBox="0 0 36 34" fill="none">
                                <path
                                    d="M18.4321 30.5111C18.2754 30.3188 18.1187 30.4342 18.1187 30.3188C17.1788 30.5495 15.4163 29.9343 14.6722 30.0112C14.8288 29.7805 14.4372 29.8189 14.4372 29.6651C14.2805 29.8959 14.1238 29.6651 13.8888 29.742C13.6538 29.1653 12.7139 29.5882 12.5964 28.8577C12.0481 28.8577 11.8522 28.55 11.3039 28.2424C11.3431 28.204 11.3822 28.204 11.4214 28.1655C11.1472 28.1271 11.1472 27.9733 10.9122 27.9733L10.9906 27.8195C10.5598 27.7425 10.4031 27.0889 9.77644 26.8582C9.58061 26.8197 9.14979 26.166 8.9148 26.0122C8.7973 25.9353 8.60147 25.9353 8.87563 25.8969C8.83646 25.8584 8.83646 25.7815 8.87563 25.7431C8.60147 25.6661 8.5623 25.4354 8.20981 25.3201C8.17065 25.2047 8.28814 25.1278 8.20981 25.0509C8.13148 25.0125 8.01398 25.0894 7.93565 25.0509C7.89649 25.7431 8.6798 25.82 8.9148 26.3967C8.83646 26.3198 8.71897 26.0891 8.64063 26.2429C8.60147 26.3583 8.95396 26.7813 8.95396 26.5505C8.83646 26.6274 8.7973 26.4352 8.87563 26.3967C8.99313 26.589 9.22812 26.5505 9.22812 26.7043C9.11062 26.8197 8.95396 26.589 8.99313 26.7813C9.34562 26.9735 9.30645 27.1658 9.50228 27.4349C9.34562 27.2427 9.30645 27.5887 9.14979 27.4349C9.11062 26.8582 8.44481 26.9735 8.44481 26.3967C8.36648 26.2045 8.28814 26.3583 8.17065 26.2814C8.32731 26.1276 7.70066 25.5892 7.70066 25.7815C7.50483 25.5508 7.62233 25.4739 7.58316 25.3201C7.4265 25.2816 7.544 25.4739 7.4265 25.3585C7.58316 25.0894 7.23067 24.7433 6.99568 24.4741L7.15234 24.3972C6.87818 24.2434 6.83901 23.9358 6.64318 23.5897C6.40819 23.9358 7.11317 24.7049 6.99568 24.8587C6.99568 24.8971 7.26984 25.2047 7.34817 25.3585C7.66149 25.8969 7.89649 26.5505 8.32731 26.8582C8.24898 26.8197 8.28814 26.589 8.40564 26.7043C8.40564 26.8197 8.32731 26.9351 8.32731 27.0504C8.5623 27.2811 8.75813 27.4734 8.99313 27.7041C8.48397 27.3965 7.97482 27.0889 7.62233 26.6274C7.81815 26.589 8.01398 26.9351 8.17065 26.8966C7.77899 26.589 7.89649 26.4736 7.73982 26.0891C7.58316 25.9738 7.77899 26.2429 7.62233 26.2814C7.11317 25.82 6.72152 25.5508 6.48652 25.1278C6.52569 25.0894 6.56485 25.0509 6.56485 24.974C6.52569 24.9356 6.52569 24.9356 6.48652 24.8971C6.72152 25.1278 6.79985 25.3201 7.07401 25.3585C6.95651 25.2432 7.07401 25.2047 6.91734 25.0894C6.83901 24.9356 6.72152 25.1663 6.64318 25.0509C6.72152 24.9356 6.64318 24.7818 6.64318 24.6664C6.56485 24.6664 6.48652 24.6664 6.44736 24.551C6.36902 24.5126 6.32986 24.551 6.29069 24.6279C6.25153 24.5895 6.25153 24.5126 6.21236 24.4741V24.4357C6.1732 24.3972 6.13403 24.3203 6.09486 24.2819C5.78154 23.4744 5.58571 22.3977 5.15489 21.7056C5.27238 21.2442 5.07656 20.3213 4.95906 20.0906C5.07656 19.8984 4.99822 19.014 4.91989 18.8602C4.72406 18.9371 4.95906 19.36 4.76323 19.4754C4.5674 18.6295 4.88073 17.6682 4.8024 16.8991C4.88073 16.8991 4.95906 16.8991 4.95906 16.8607C4.84156 16.7453 5.03739 16.5146 4.99823 16.2454C5.15489 15.8994 4.64573 16.7453 4.64573 17.0914C4.60657 17.1683 4.4499 17.0914 4.48907 17.2836C4.48907 17.5528 4.5674 18.0911 4.41074 18.4757C4.33241 18.4757 4.33241 18.3987 4.25408 18.4372C4.21491 18.6295 4.17574 18.8602 4.13658 19.0524C4.09741 18.9755 4.05825 18.8602 4.05825 18.8217C3.86242 17.8604 4.05825 16.7453 3.97992 15.9378C4.13658 15.9378 4.13658 15.7071 4.25408 15.6302C4.21491 15.9378 4.13658 16.3223 4.33241 16.3992C4.48907 14.8996 4.8024 13.2462 5.50738 11.6312C6.01653 10.4392 6.76068 9.2472 7.66149 8.28591C7.73982 8.40126 7.62233 8.67043 7.66149 8.78578C8.44481 7.97829 8.95396 7.017 9.81561 6.47867C9.85477 6.67093 9.46311 6.82474 9.46311 6.97855C9.81561 6.63248 9.9331 6.74783 10.3248 6.63248C10.4423 6.47867 10.1681 6.63248 10.1289 6.47867C10.3639 6.32486 10.5206 6.1326 10.6773 6.01725C10.6773 6.0557 10.6381 6.0557 10.6381 6.09415C11.0689 5.9788 11.1081 5.74809 11.4214 5.67118C11.3822 5.63273 11.3039 5.59428 11.1864 5.63273C11.2647 5.59428 11.3822 5.51737 11.4997 5.47892C11.4606 5.47892 11.4606 5.51738 11.4214 5.51738C11.6564 5.40202 11.4606 5.55583 11.4606 5.63273C11.4997 5.63273 11.5389 5.59428 11.5389 5.59428C11.3039 5.74809 11.1472 5.82499 11.0689 6.09415C11.1864 6.01725 11.2256 6.09415 11.3822 5.9788C11.5389 5.90189 11.3431 5.78654 11.4606 5.70963C11.5781 5.78654 11.7347 5.74809 11.8522 5.74809C11.8522 5.67118 11.8914 5.59428 11.9697 5.55583C12.0089 5.47892 11.9697 5.44047 11.9306 5.44047C11.9697 5.40202 12.0089 5.40202 12.0872 5.36357C12.0872 5.36357 12.1264 5.36357 12.1264 5.40202C12.7922 5.0944 13.5363 4.82524 14.2413 4.59453C14.6722 4.55608 15.2205 4.55608 15.4555 4.28692C15.3771 4.28692 15.2988 4.32537 15.2596 4.28692C15.2988 4.28692 15.3771 4.24846 15.4163 4.24846C15.4946 4.32537 15.6121 4.24846 15.4946 4.40227C15.5338 4.40227 15.5338 4.40227 15.573 4.36382C15.573 4.40227 15.573 4.40227 15.6121 4.44072C15.6513 4.44072 15.6905 4.40227 15.7296 4.32537C15.7688 4.32537 15.808 4.32537 15.8471 4.28692L15.808 4.32537C16.1213 4.24846 16.3954 4.28692 16.8263 4.21001C16.8263 4.17156 16.8263 4.13311 16.8263 4.09466C16.9046 4.09466 16.9438 4.0562 17.0221 4.0562V4.09466C17.1788 4.01775 17.3354 4.17156 17.3354 4.09466C17.3746 4.09466 17.3746 4.09466 17.4138 4.09466C17.4138 4.17156 17.3746 4.21001 17.3746 4.24846C17.5704 4.24846 17.6879 4.24846 17.7662 4.13311C17.7271 4.09466 17.6879 4.09466 17.6487 4.09466C17.7271 4.09466 17.8054 4.0562 17.8837 4.01775C18.0012 4.0562 18.0404 4.09466 18.0404 4.24846C18.2362 3.9024 18.8629 4.32537 19.137 4.24846C19.2545 4.24846 19.2154 4.09466 19.2937 4.01775C19.3329 4.01775 19.372 4.01775 19.4112 4.01775C19.607 4.17156 19.8812 4.32537 20.2337 4.36382C19.9204 4.28692 20.2728 4.24846 20.312 4.21001C20.2337 4.21001 20.2337 4.17156 20.2337 4.13311C20.3512 4.13311 20.4687 4.17156 20.5862 4.17156C20.5862 4.24846 20.6253 4.28692 20.7037 4.28692C20.782 4.28692 20.782 4.24846 20.782 4.17156C20.8995 4.17156 20.9778 4.17156 21.0953 4.21001C21.0562 4.36382 21.2912 4.40227 21.3695 4.51763C21.0562 4.44072 20.7037 4.32537 20.5862 4.51763C21.8395 4.78679 23.2103 5.17131 24.5419 5.82499C24.5419 5.82499 24.5419 5.82499 24.5419 5.86344H24.5811C24.8161 5.9788 25.0511 6.09415 25.2861 6.20951C25.4427 6.28641 25.5602 6.36332 25.7169 6.47867C25.7169 6.51712 25.7169 6.55557 25.7952 6.55557H25.8344C25.991 6.67093 26.1477 6.74783 26.3044 6.86319C26.461 7.0939 26.6177 7.40152 26.8919 7.32461C27.4793 8.209 28.106 8.55507 28.6151 9.47792C28.6543 9.32411 28.7718 9.82398 28.9676 9.86243C28.6543 9.82398 29.1635 10.0547 28.8501 10.0162C29.1243 10.2854 29.2026 10.4008 29.2418 10.7084C29.1635 10.5546 29.1243 10.5161 29.0851 10.6699C29.046 10.9006 29.3593 10.6315 29.4768 10.8622C29.2418 10.8622 29.3201 11.016 29.3593 11.2082C29.4768 11.0929 29.4376 10.9775 29.5551 11.016C29.7118 11.1698 29.4768 11.2082 29.516 11.3236C29.6335 11.1698 29.6726 11.2467 29.8293 11.3236C29.6335 11.3621 29.9468 11.6312 29.7118 11.5159C29.8684 11.7081 29.9076 11.8235 29.8293 12.0157C29.6726 11.785 29.7901 11.6312 29.5551 11.6697C30.0251 12.0542 29.7901 12.9386 30.3384 13.0155C29.9859 13.0924 30.3384 13.2462 30.1426 13.2846C30.3776 13.3616 30.2601 13.6692 30.5343 13.7461C30.4951 13.9383 30.4168 14.0537 30.3776 14.2459C30.4951 14.3998 30.5343 14.7074 30.7301 14.7458C30.6126 14.8612 30.6909 15.1688 30.5734 15.2841C30.7301 15.2072 30.8084 15.2072 30.9259 15.361C30.7301 15.5149 30.8868 15.6687 30.7693 15.7071C31.1217 16.5915 30.6909 18.3987 30.8868 19.0909C30.6518 18.9755 30.7301 19.36 30.5734 19.36C30.8476 19.4754 30.6126 19.6677 30.7301 19.8599C30.1818 20.1675 30.7301 21.0135 29.9859 21.2057C30.0643 21.7441 29.751 21.9748 29.516 22.5515C29.4768 22.5131 29.4768 22.4746 29.4376 22.4362C29.3985 22.7054 29.2418 22.7438 29.3201 22.9745L29.1635 22.8976C29.1635 23.3206 28.4976 23.5513 28.341 24.205C28.3018 24.3972 27.7143 24.8971 27.5577 25.1663C27.4793 25.2816 27.5185 25.4739 27.4402 25.2047C27.401 25.2432 27.3227 25.2432 27.2835 25.2432C27.2443 25.5123 27.0093 25.5892 26.931 25.9353C26.8527 25.9738 26.7352 25.8584 26.6569 25.9738C26.6569 26.0507 26.7352 26.166 26.696 26.2429C27.401 26.2045 27.401 25.397 27.9493 25.1278C27.9102 25.2432 27.6752 25.3585 27.8318 25.4354C27.9493 25.4354 28.3018 25.0509 28.106 25.0894C28.2235 25.1663 27.9885 25.2432 27.9493 25.2047C28.1452 25.0509 28.0668 24.8587 28.2235 24.8202C28.341 24.8971 28.106 25.0894 28.341 25.0509C28.4976 24.7049 28.6935 24.6664 28.9285 24.4741C28.7718 24.6279 29.1243 24.6664 28.9676 24.8202C28.3802 24.9356 28.576 25.5892 27.9885 25.6661C27.8318 25.7815 27.9493 25.82 27.9102 25.9353C27.7143 25.82 27.2835 26.4736 27.4402 26.4352C27.2443 26.6274 27.1268 26.5505 26.9702 26.589C26.931 26.7428 27.1268 26.6274 27.0485 26.7428C26.7744 26.6274 26.4219 27.012 26.1869 27.2811L26.0694 27.1658C25.9519 27.4734 25.6386 27.5118 25.2861 27.7425C25.6777 27.9348 26.3435 27.1273 26.5394 27.2427C26.5785 27.2427 26.8919 26.9351 27.0094 26.8197C27.5185 26.4352 28.1452 26.1276 28.3802 25.7046C28.341 25.7815 28.106 25.7815 28.2235 25.6661C28.341 25.6277 28.4585 25.7046 28.576 25.7046C29.2026 24.8587 29.9859 24.1665 30.5734 23.1668C30.6126 23.1283 30.6518 23.0514 30.6909 22.9745C30.6126 23.2052 30.4951 23.3975 30.4168 23.6282C29.7901 24.0512 29.5551 25.2816 28.811 25.4739C28.8501 25.8969 28.4585 26.0122 28.2627 26.5121C28.1452 26.6659 28.0668 26.3967 27.9493 26.589C28.0668 27.1273 26.9702 27.0889 27.0094 27.5887C26.931 27.6272 26.8135 27.6656 26.7352 27.7425H26.696C26.6569 27.781 26.6569 27.781 26.6177 27.8195C26.4219 27.9348 26.2652 28.0502 26.1085 28.1655C25.5602 28.4731 24.8161 28.7038 24.2286 29.0115V28.973C24.0719 29.0499 23.8761 29.0115 23.9153 29.1653C23.7978 29.2422 23.6803 29.3191 23.5628 29.396C23.5236 29.396 23.5236 29.396 23.4844 29.396C23.4844 29.396 23.4453 29.3575 23.4061 29.3575C23.3278 29.3575 23.3278 29.3575 23.2886 29.396C22.7795 29.4344 22.1136 29.6651 21.9178 29.8189C21.722 29.7036 20.8212 29.8959 20.6645 29.9728C20.7428 30.0881 20.9778 29.9728 21.1737 29.9728C21.0562 30.0112 20.9387 30.0497 20.8995 30.1266C20.8603 30.1266 20.8603 30.1266 20.8212 30.1266C20.782 30.0112 20.6645 30.1266 20.6253 30.0881H20.6645C20.6253 29.9343 20.5078 29.8574 20.312 29.8959C20.312 29.9728 20.312 30.0112 20.2728 30.0881C20.3512 30.0881 20.5862 29.9728 20.5862 30.0881C20.547 30.0881 20.547 30.1266 20.5862 30.1266C20.5078 30.2035 20.3903 30.2035 20.312 30.2419C20.1554 30.2419 19.9595 30.2419 19.8029 30.2419C19.7637 30.2035 19.7245 30.2035 19.6462 30.165C19.607 30.2035 19.5287 30.2035 19.4895 30.2419C19.2545 30.2419 18.9804 30.2804 18.7846 30.3188C18.7846 30.2419 18.7846 30.165 18.7062 30.165C18.5887 30.3188 18.3537 30.1266 18.0796 30.2035C17.8054 30.1266 18.2362 30.3188 18.6279 30.3957C18.5887 30.4342 18.5496 30.4726 18.4321 30.5111ZM12.9489 31.0494C12.4005 30.5495 11.2647 30.3188 11.0689 29.9343C10.7556 29.8959 10.2856 29.3191 9.89394 29.2422C10.0898 29.2422 9.9331 29.1268 9.89394 29.0499C9.81561 29.1268 9.73727 29.1653 9.65894 29.1653C9.65894 28.8577 9.34562 28.6654 9.07146 28.4731C9.26729 28.5885 9.42395 28.6654 9.65894 28.7038C9.65894 28.6269 9.65894 28.55 9.73727 28.55C10.0114 28.8192 10.3248 29.0884 10.6773 29.3575C11.1472 29.7805 13.5755 30.8571 14.0063 31.0494C14.0063 31.0494 13.928 31.2032 13.9672 31.2032C14.163 31.3186 14.3197 31.0879 14.3588 31.357C13.7322 31.4339 13.4972 31.011 12.9489 31.0494ZM31.0043 22.1286V22.167C30.9651 22.167 31.0043 22.1286 31.0043 22.1286ZM15.1813 4.32537C15.1421 4.36382 15.103 4.36382 15.103 4.36382C15.103 4.32537 15.1421 4.32537 15.1813 4.32537ZM11.8522 5.32512C11.8914 5.28666 11.8914 5.28666 11.9306 5.28666C11.8914 5.28666 11.8522 5.32512 11.8522 5.32512ZM18.1187 4.0562C18.0404 4.0562 18.0012 4.0562 17.9621 4.01775C18.0012 4.01775 18.0404 4.01775 18.0796 4.01775H18.1187C18.1187 4.01775 18.1187 4.01775 18.1187 4.0562ZM18.8237 4.13311C18.7846 4.09466 18.6671 4.0562 18.5496 4.0562C18.5496 4.01775 18.5887 3.9793 18.5887 3.9793C18.6279 3.9793 18.6671 3.9793 18.7062 3.9793C18.7062 3.9793 18.7454 3.9793 18.7454 4.01775C18.7454 4.01775 18.7454 4.01775 18.7454 3.9793C18.7846 3.9793 18.7846 3.9793 18.8237 3.9793C18.8629 4.0562 18.902 4.09466 18.8237 4.13311ZM20.1162 4.24846C19.9204 4.28692 19.8029 4.21001 19.607 4.09466C19.7245 4.09466 19.8812 4.13311 19.9987 4.17156C20.0379 4.17156 20.077 4.21001 20.1162 4.24846ZM34.0592 9.70863C33.9808 9.74708 33.9417 9.74708 33.8633 9.59327C33.2367 8.28591 32.1009 6.40177 30.4559 4.82524C28.8501 3.21026 26.696 1.9029 24.7377 1.21077C24.8552 1.24922 25.0119 1.32612 24.9336 1.40303C23.2103 0.749345 21.5653 0.364826 19.9987 0.211019C15.7688 -0.442663 11.3431 0.44173 7.93565 2.59503C7.97482 2.67194 7.97482 2.71039 7.85732 2.78729C6.60402 3.55633 4.84156 4.90215 3.4316 6.67093C2.02163 8.43972 0.924991 10.6699 0.455003 12.6694C0.494168 12.5541 0.533334 12.3618 0.611666 12.4387C-0.406643 16.3992 -0.132483 19.783 1.27748 22.7054C1.35581 22.6285 1.08165 22.2439 1.31665 22.2824C1.47331 22.7054 1.66914 23.1668 1.90413 23.5897C2.17829 24.205 2.49162 25.0125 2.92244 25.2047C1.8258 23.0899 1.08165 20.6674 1.00332 18.5141C1.15999 18.8217 1.12082 19.4754 1.35581 19.7446C1.43415 18.2834 1.08165 16.3223 1.59081 14.9381C1.47331 15.6687 1.39498 16.6684 1.47331 17.6682C1.47331 18.3987 1.8258 20.4367 2.0608 20.629C2.02163 20.5905 2.02163 20.3982 2.0608 20.3982C2.17829 20.629 1.90413 20.7443 2.09996 20.7828C2.09996 20.7059 2.13913 20.7059 2.17829 20.7059C2.56995 21.5518 3.07911 22.8592 3.47076 23.5128C3.94075 24.3588 4.5674 25.1278 5.27238 25.82C5.27238 25.8584 5.31155 25.8584 5.31155 25.8969C5.38988 26.0891 5.66404 26.3198 5.74237 26.4736C5.78154 26.5505 5.70321 26.6659 5.74237 26.7428C6.32986 27.8195 7.1915 28.8961 8.24898 29.742C8.91479 30.5111 9.97227 31.3186 11.2647 32.0107C12.518 32.6644 13.9672 33.2027 15.2988 33.5103C16.2388 33.741 17.3746 33.7795 18.0796 33.9333C19.0195 34.1256 20.6645 33.8564 21.487 33.7026C26.4219 32.972 31.3176 29.6651 33.785 24.8971C36.3308 20.0906 36.2525 14.2075 34.0592 9.70863Z"
                                    fill="#267EE6"
                                />
                            </svg>
                            Kwikvote
                        </div>
                    </Link>
                    <ActiveLink label="Accueil" href="/" />
                    <ActiveLink label="Mes sondages" href="/mes-sondages" />
                    <ActiveLink label="FAQ" href="/faq" />
                </div>
                <div className="flex gap-2">
                    <Popover>
                        <TooltipProvider>
                            <Tooltip delayDuration={300}>
                                <PopoverTrigger asChild>
                                    <TooltipTrigger asChild>
                                        <Button variant="secondary" size="icon">
                                            <History className="w-5 h-5" />
                                        </Button>
                                    </TooltipTrigger>
                                </PopoverTrigger>
                                <TooltipContent className="hidden sm:block">Sondages consultés</TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                        <PopoverContent>
                            <ConsultedHistory />
                        </PopoverContent>
                    </Popover>
                    <Button className="h-10 w-10 p-0 sm:h-auto sm:w-auto sm:py-2 sm:px-4" asChild>
                        <Link href="/poll/create">
                            <PlusCircle className="sm:hidden w-5 h-5" />
                            <span className="hidden sm:block">Créer un sondage</span>
                        </Link>
                    </Button>
                    <Button onClick={() => setMobileNavOpen(true)} className="sm:hidden" size="icon">
                        <Menu className="w-5 h-5" />
                    </Button>
                </div>
            </div>
            {mobileNavOpen && (
                <>
                    <div className="fixed inset-0 h-screen bg-[#0000004c] sm:hidden" onClick={() => setMobileNavOpen(false)} />
                    <Card className="absolute z-50 top-[64px] left-4 py-2 px-4 w-[calc(100%-32px)] flex flex-col sm:hidden">
                        <ActiveLink mobileItem={true} label="Accueil" href="/" />
                        <ActiveLink mobileItem={true} label="Mes sondages" href="/mes-sondages" />
                        <ActiveLink mobileItem={true} label="FAQ" href="/faq" />
                    </Card>
                </>
            )}
        </nav>
    );
}
