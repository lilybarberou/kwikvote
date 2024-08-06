import { Skeleton } from "../ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";

export default function PollSkeleton() {
  return (
    <div>
      <Skeleton className="mb-5 h-[28px] w-[200px] rounded-full" />
      <Skeleton className="h-[53.6px] w-[280px] rounded-sm" />
      <Skeleton className="mt-10 h-[40px] w-[203.86px] rounded-sm" />
      <Table className="mt-2">
        <TableHeader>
          <TableRow>
            <TableHead>
              <Skeleton className="h-[40px] w-[120.8px] rounded-sm" />
            </TableHead>
            <TableHead className="py-4">
              <div className="flex flex-col items-center gap-1">
                <Skeleton className="h-[16px] w-[67.1px] rounded-full" />
                <Skeleton className="h-[16px] w-[34.475px] rounded-full" />
                <Skeleton className="h-[16px] w-[34.475px] rounded-full" />
              </div>
            </TableHead>
            <TableHead className="py-4">
              <div className="flex flex-col items-center gap-1">
                <Skeleton className="h-[16px] w-[70px] rounded-full" />
                <Skeleton className="h-[16px] w-[34.475px] rounded-full" />
                <Skeleton className="h-[16px] w-[34.475px] rounded-full" />
              </div>
            </TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell className="flex justify-between">
              <Skeleton className="h-[20px] w-[41px] rounded-full" />
              <Skeleton className="h-[20px] w-[32px] rounded-full" />
            </TableCell>
            <TableCell>
              <div className="flex justify-between">
                <Skeleton className="h-[20px] w-[26px] rounded-full" />
                <Skeleton className="h-[20px] w-[26px] rounded-full" />
              </div>
            </TableCell>
            <TableCell>
              <div className="flex justify-between">
                <Skeleton className="h-[20px] w-[26px] rounded-full" />
                <Skeleton className="h-[20px] w-[26px] rounded-full" />
              </div>
            </TableCell>
            <TableCell />
          </TableRow>
          {Array.from({ length: 2 }).map((_, i) => (
            <TableRow key={i}>
              <TableCell className="py-2">
                <Skeleton className="my-auto h-[20px] w-[50px] rounded-full" />
              </TableCell>
              <TableCell className="py-2">
                <Skeleton className="m-auto h-[16px] w-[16px] rounded-full" />
              </TableCell>
              <TableCell className="py-2">
                <Skeleton className="m-auto h-[16px] w-[16px] rounded-full" />
              </TableCell>
              <TableCell className="py-2">
                <Skeleton className="m-auto h-[30px] w-[30px] rounded-sm" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
