import { Skeleton } from './ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';

export default function PollSkeleton() {
    return (
        <div className="m-auto mt-4">
            <Skeleton className="mb-5 w-[200px] h-[28px] rounded-full" />
            <Skeleton className="w-[280px] h-[53.6px] rounded-sm" />
            <Skeleton className="mt-10 w-[203.86px] h-[40px] rounded-sm" />
            <Table className="mt-2 w-fit">
                <TableHeader>
                    <TableRow>
                        <TableHead>
                            <Skeleton className="w-[120.8px] h-[40px] rounded-sm" />
                        </TableHead>
                        <TableHead className="py-4">
                            <div className="flex flex-col items-center gap-1">
                                <Skeleton className="w-[67.1px] h-[16px] rounded-full" />
                                <Skeleton className="w-[34.475px] h-[16px] rounded-full" />
                                <Skeleton className="w-[34.475px] h-[16px] rounded-full" />
                            </div>
                        </TableHead>
                        <TableHead className="py-4">
                            <div className="flex flex-col items-center gap-1">
                                <Skeleton className="w-[70px] h-[16px] rounded-full" />
                                <Skeleton className="w-[34.475px] h-[16px] rounded-full" />
                                <Skeleton className="w-[34.475px] h-[16px] rounded-full" />
                            </div>
                        </TableHead>
                        <TableHead />
                    </TableRow>
                </TableHeader>
                <TableBody>
                    <TableRow>
                        <TableCell className="flex justify-between">
                            <Skeleton className="w-[41px] h-[20px] rounded-full" />
                            <Skeleton className="w-[32px] h-[20px] rounded-full" />
                        </TableCell>
                        <TableCell>
                            <div className="flex justify-between">
                                <Skeleton className="w-[26px] h-[20px] rounded-full" />
                                <Skeleton className="w-[26px] h-[20px] rounded-full" />
                            </div>
                        </TableCell>
                        <TableCell>
                            <div className="flex justify-between">
                                <Skeleton className="w-[26px] h-[20px] rounded-full" />
                                <Skeleton className="w-[26px] h-[20px] rounded-full" />
                            </div>
                        </TableCell>
                        <TableCell />
                    </TableRow>
                    {Array.from({ length: 2 }).map((_, i) => (
                        <TableRow key={i}>
                            <TableCell className="py-2">
                                <Skeleton className="my-auto w-[50px] h-[20px] rounded-full" />
                            </TableCell>
                            <TableCell className="py-2">
                                <Skeleton className="m-auto w-[16px] h-[16px] rounded-full" />
                            </TableCell>
                            <TableCell className="py-2">
                                <Skeleton className="m-auto w-[16px] h-[16px] rounded-full" />
                            </TableCell>
                            <TableCell className="py-2">
                                <Skeleton className="m-auto w-[30px] h-[30px] rounded-sm" />
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}
