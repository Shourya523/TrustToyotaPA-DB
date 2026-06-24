"use client";

import DashboardLayout from "../../components/dashboard/DashboardLayout";
import ShowroomOverview from "../../components/showroom/ShowroomOverview";
import PlatformAnalytics from "../../components/dashboard/PlatformAnalytics";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";

export default function DashboardOverview() {
  return (
    <DashboardLayout>
      <Tabs defaultValue="platform" className="w-full">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold tracking-tight">Executive Dashboard</h1>
          <TabsList>
            <TabsTrigger value="platform">Platform Analytics</TabsTrigger>
            <TabsTrigger value="showroom">Showroom Analytics</TabsTrigger>
          </TabsList>
        </div>
        
        <TabsContent value="platform">
          <PlatformAnalytics />
        </TabsContent>
        
        <TabsContent value="showroom" className="mt-0">
          <ShowroomOverview />
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
}
