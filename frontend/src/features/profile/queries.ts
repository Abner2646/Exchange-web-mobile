import { useQuery, useMutation, useQueryClient } from 'react-query';
import { profileApi, UpdateProfileRequest, EmailChangeRequest, EmailChangeConfirmRequest } from './api';

export const useProfile = () => {
  return useQuery(['profile'], profileApi.fetchProfile);
};

export const useUpdateProfile = () => {
  const queryClient = useQueryClient();
  return useMutation(
    (data: UpdateProfileRequest) => profileApi.updateProfile(data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['profile']);
      },
    }
  );
};

export const useRequestEmailChange = () => {
  return useMutation((data: EmailChangeRequest) => profileApi.requestEmailChange(data));
};

export const useConfirmEmailChange = () => {
  return useMutation((data: EmailChangeConfirmRequest) => profileApi.confirmEmailChange(data));
};
